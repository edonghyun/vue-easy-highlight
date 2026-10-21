/**
 * The single event layer every adapter attaches to its rendered root, so that
 * select / click / dblclick / keyboard / hover behave identically everywhere.
 */
import type { InteractionHandlers, PointDetail } from '../events';
import { highlightsInRange, segmentAt } from '../segments';
import type { Segment } from '../types';
import { getOffsetFromPoint, getSelectionOffsets } from './offsets';

export interface InteractionOptions<
    T = unknown,
> extends InteractionHandlers<T> {
    getText: () => string;
    getSegments: () => readonly Segment<T>[];
    /**
     * Minimum selection length (code units) for `onSelect`. Default 1.
     * Read each time it is needed, like every other field of `options`,
     * so it may be changed (or defined as a getter) after attaching.
     */
    minSelectionLength?: number;
    /**
     * Touch selections are confirmed after this many ms without change.
     * Default 500. Read each time a selection change starts the wait, so a
     * changed value applies from the next selection change.
     */
    touchSelectionDelay?: number;
}

const SEG = '[data-om-start]';

/**
 * Attaches the interaction listeners to `root`; returns `detach`.
 * `options` is read live: handlers and settings are looked up on every event,
 * so callers can mutate it (or expose getters) instead of re-attaching.
 */
export function attachInteractions<T>(
    root: HTMLElement,
    options: InteractionOptions<T>,
): () => void {
    const minLength = (): number => options.minSelectionLength ?? 1;
    const touchDelay = (): number => options.touchSelectionDelay ?? 500;

    // ---- select ----------------------------------------------------------
    let pending = false;
    let last: { start: number; end: number } | null = null;
    let lastPointerType = '';
    let touchTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTouchTimer = (): void => {
        if (touchTimer !== undefined) clearTimeout(touchTimer);
        touchTimer = undefined;
    };

    const clearReleaseTimer = (): void => {
        if (releaseTimer !== undefined) clearTimeout(releaseTimer);
        releaseTimer = undefined;
    };

    const confirm = (): void => {
        clearTouchTimer();
        clearReleaseTimer();
        if (!pending) return;
        pending = false;
        const selection = window.getSelection();
        const offsets = getSelectionOffsets(root, selection);
        if (!selection || !offsets) {
            last = null;
            return;
        }
        const { start, end } = offsets;
        if (end - start < minLength()) return;
        if (last && last.start === start && last.end === end) return;
        last = { start, end };
        options.onSelect?.({
            start,
            end,
            text: options.getText().slice(start, end),
            rect: selection.getRangeAt(0).getBoundingClientRect(),
            highlights: highlightsInRange(options.getSegments(), start, end),
        });
    };

    const onSelectionChange = (): void => {
        if (!getSelectionOffsets(root)) {
            // Empty, or entirely outside this root: forget the previous emit.
            pending = false;
            last = null;
            clearTouchTimer();
            return;
        }
        pending = true;
        if (lastPointerType === 'touch') {
            clearTouchTimer();
            touchTimer = setTimeout(confirm, touchDelay());
        }
    };

    // `selectionchange` is queued asynchronously, so the change caused by the
    // last key press (or the last drag step) can arrive after its keyup/pointerup.
    // Confirm on the next task so that change is already accounted for.
    const confirmSoon = (): void => {
        clearReleaseTimer();
        releaseTimer = setTimeout(confirm, 0);
    };

    // Shift+Arrow (and Ctrl/Alt/Meta-modified) selections grow one key at a
    // time; confirm only once every modifier is released, so a run of steps
    // emits a single `select` (on the modifier's own keyup).
    const onKeyUp = (e: KeyboardEvent): void => {
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        confirmSoon();
    };

    // Chromium neither starts a drag selection nor places a caret when a mouse
    // press on a focusable element lands at the very start of its text. So a
    // press on a focusable segment lifts its tabindex until the button is
    // released; a press that ends without a selection (a click) then focuses
    // the segment, as the browser would have.
    let lifted: { el: HTMLElement; tabindex: string } | null = null;

    const putBackTabindex = (): HTMLElement | null => {
        if (!lifted) return null;
        const { el, tabindex } = lifted;
        lifted = null;
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', tabindex);
        return el;
    };

    const onPointerDown = (e: PointerEvent): void => {
        lastPointerType = e.pointerType;
        putBackTabindex();
        if (e.pointerType === 'touch') return;
        const el = segmentElementOf(e.target);
        const tabindex = el?.getAttribute('tabindex');
        if (!(el instanceof HTMLElement) || tabindex == null) return;
        lifted = { el, tabindex };
        el.removeAttribute('tabindex');
    };

    const onPointerUp = (): void => {
        const pressed = putBackTabindex();
        if (
            pressed?.isConnected &&
            window.getSelection()?.isCollapsed !== false
        )
            pressed.focus({ preventScroll: true });
        // Touch selections are confirmed by the settle timer, not by lifting the finger.
        if (lastPointerType !== 'touch') confirmSoon();
    };

    // ---- click / dblclick / keyboard -------------------------------------
    const segmentElementOf = (target: EventTarget | null): Element | null => {
        const el =
            target instanceof Element
                ? target
                : target instanceof Node
                  ? target.parentElement
                  : null;
        const seg = el?.closest(SEG);
        return seg && root.contains(seg) ? seg : null;
    };

    const segmentOf = (el: Element): Segment<T> | undefined =>
        segmentAt(
            options.getSegments(),
            Number(el.getAttribute('data-om-start')),
        );

    const pointDetail = (e: MouseEvent): PointDetail<T> | null => {
        const el = segmentElementOf(e.target);
        const segment = el && segmentOf(el);
        if (!segment) return null;
        const hit = getOffsetFromPoint(root, e.clientX, e.clientY);
        const offset =
            hit === null
                ? segment.start
                : Math.min(Math.max(hit, segment.start), segment.end - 1);
        return { offset, segment, highlights: segment.highlights, event: e };
    };

    const onClick = (e: MouseEvent): void => {
        if (!options.onClick) return;
        // A click that ends a drag selection is not a click on the text.
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        const d = pointDetail(e);
        if (d) options.onClick(d);
    };

    const onDblclick = (e: MouseEvent): void => {
        if (!options.onDblclick) return;
        // The browser's word selection is expected here; emit regardless.
        const d = pointDetail(e);
        if (d) options.onDblclick(d);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target;
        if (
            !(el instanceof Element) ||
            !el.matches(`${SEG}[tabindex]`) ||
            !root.contains(el)
        )
            return;
        const segment = segmentOf(el);
        if (!segment) return;
        // A held Space would still scroll the page, so repeats keep being
        // prevented; only the first press of a held key is a click.
        e.preventDefault();
        if (e.repeat) return;
        options.onClick?.({
            offset: segment.start,
            segment,
            highlights: segment.highlights,
            event: e,
        });
    };

    // ---- hover -----------------------------------------------------------
    let hovered: { el: Element; segment: Segment<T> } | null = null;
    const highlightedSegmentAt = (
        target: EventTarget | null,
    ): { el: Element; segment: Segment<T> } | null => {
        const el = segmentElementOf(target);
        const segment = el && segmentOf(el);
        return el && segment && segment.depth > 0 ? { el, segment } : null;
    };

    const leave = (e: PointerEvent | null): void => {
        if (!hovered) return;
        const { segment } = hovered;
        hovered = null;
        observer.disconnect();
        options.onHover?.({
            type: 'leave',
            segment,
            highlights: segment.highlights,
            event: e,
        });
    };

    // Where the mouse was at its last pointerover/pointerout, to find what is
    // under it after a re-render.
    let pointerX = 0;
    let pointerY = 0;

    const sameHighlights = (x: Segment<T>, y: Segment<T>): boolean =>
        x.highlights.length === y.highlights.length &&
        x.highlights.every((h, i) => h.id === y.highlights[i].id);

    // An adapter re-render can replace the hovered element while the mouse
    // stays still. Observer callbacks run as microtasks, so this runs after
    // the adapter's synchronous update, once selection and focus are restored.
    const onRootMutated = (): void => {
        if (!hovered || root.contains(hovered.el)) return;
        const under = highlightedSegmentAt(
            document.elementFromPoint(pointerX, pointerY),
        );
        if (
            under &&
            under.segment.start === hovered.segment.start &&
            sameHighlights(under.segment, hovered.segment)
        ) {
            // The same segment, re-rendered: keep hovering it. `leave` still
            // reports the segment object from `enter`.
            hovered = { el: under.el, segment: hovered.segment };
            return;
        }
        // The hovered highlight is gone from under the pointer; no pointer
        // event caused that, hence `event: null`.
        leave(null);
    };
    const observer = new MutationObserver(onRootMutated);

    const onPointerOver = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return;
        pointerX = e.clientX;
        pointerY = e.clientY;
        const next = highlightedSegmentAt(e.target);
        if (next?.el === hovered?.el) return;
        leave(e);
        if (!next) return;
        hovered = next;
        observer.observe(root, { childList: true, subtree: true });
        options.onHover?.({
            type: 'enter',
            segment: next.segment,
            highlights: next.segment.highlights,
            event: e,
        });
    };

    const onPointerOut = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return;
        pointerX = e.clientX;
        pointerY = e.clientY;
        // Moving between nested marks of the same segment is not a leave.
        if (highlightedSegmentAt(e.relatedTarget)?.el === hovered?.el) return;
        leave(e);
    };

    // ---- wiring ----------------------------------------------------------
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', putBackTabindex, true);
    document.addEventListener('keyup', onKeyUp, true);
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', onDblclick);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);

    return () => {
        clearTouchTimer();
        clearReleaseTimer();
        document.removeEventListener('selectionchange', onSelectionChange);
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', putBackTabindex, true);
        document.removeEventListener('keyup', onKeyUp, true);
        root.removeEventListener('click', onClick);
        root.removeEventListener('dblclick', onDblclick);
        root.removeEventListener('keydown', onKeyDown);
        root.removeEventListener('pointerover', onPointerOver);
        root.removeEventListener('pointerout', onPointerOut);
        putBackTabindex();
        pending = false;
        last = null;
        // The pointer can no longer be tracked, so the hovered segment ends
        // here. No pointer event caused it, hence `event: null`.
        leave(null);
    };
}
