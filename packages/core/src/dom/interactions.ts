/**
 * The single event layer every adapter attaches to its rendered root, so that
 * select / click / dblclick / keyboard / hover behave identically everywhere.
 */
import type { InteractionHandlers, PointDetail } from '../events';
import { highlightsInRange, segmentAt } from '../segments';
import type { Segment } from '../types';
import {
    createRangeFromOffsets,
    getOffsetFromPoint,
    getSelectionOffsets,
} from './offsets';
import { elementAt, isElement, isNode, isSelectionCollapsed } from './tree';

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
 * Document-level listeners go on the document `root` belongs to when
 * attaching, and its window: an iframe's, for a root inside one.
 */
export function attachInteractions<T>(
    root: HTMLElement,
    options: InteractionOptions<T>,
): () => void {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
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
        const offsets = getSelectionOffsets(root);
        if (!offsets) {
            last = null;
            return;
        }
        const { start, end } = offsets;
        if (end - start < minLength()) return;
        if (last && last.start === start && last.end === end) return;
        last = { start, end };
        // The selected text inside the root: inside a shadow root, the
        // selection's own ranges may be retargeted to its host.
        const rect = createRangeFromOffsets(
            root,
            start,
            end,
        )!.getBoundingClientRect();
        options.onSelect?.({
            start,
            end,
            text: options.getText().slice(start, end),
            rect,
            highlights: highlightsInRange(options.getSegments(), start, end),
        });
    };

    const onSelectionChange = (): void => {
        // A detached root holds no selection; its state waits for its return.
        if (!root.isConnected) return;
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
    // released: the attribute holds LIFTED, which is not an integer and so
    // makes the element unfocusable. A renderer that patches the segment in
    // the meantime overwrites or removes that value, and what it rendered
    // stays; only an untouched LIFTED gets the old value back. A mouse press
    // on a highlight therefore focuses it on release, when it ends without a
    // selection (a click), instead of on press. Only a plain left press lifts
    // it: another button, or Ctrl+click on macOS, may open a context menu,
    // after which no pointerup arrives. The menu opening, or the window
    // losing focus, also puts the tabindex back.
    const LIFTED = 'om-lifted';
    let lifted: { el: HTMLElement; tabindex: string } | null = null;

    /** Puts the lifted tabindex back; returns the segment when it did. */
    const putBackTabindex = (): HTMLElement | null => {
        if (!lifted) return null;
        const { el, tabindex } = lifted;
        lifted = null;
        if (el.getAttribute('tabindex') !== LIFTED) return null;
        el.setAttribute('tabindex', tabindex);
        return el;
    };

    const onPointerDown = (e: PointerEvent): void => {
        lastPointerType = e.pointerType;
        putBackTabindex();
        if (e.pointerType === 'touch' || e.button !== 0 || e.ctrlKey) return;
        // On the document, the target of a press inside a shadow root is
        // its host; the composed path starts at the element pressed.
        const el = segmentElementOf(e.composedPath()[0] ?? e.target);
        const tabindex = el?.getAttribute('tabindex');
        if (!el || tabindex == null) return;
        lifted = { el: el as HTMLElement, tabindex };
        el.setAttribute('tabindex', LIFTED);
    };

    const onPointerUp = (): void => {
        const pressed = putBackTabindex();
        if (pressed?.isConnected && isSelectionCollapsed(root))
            pressed.focus({ preventScroll: true });
        // Touch selections are confirmed by the settle timer, not by lifting the finger.
        if (lastPointerType !== 'touch') confirmSoon();
    };

    // ---- click / dblclick / keyboard -------------------------------------
    const segmentElementOf = (target: EventTarget | null): Element | null => {
        const el = isElement(target)
            ? target
            : isNode(target)
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
        if (!isSelectionCollapsed(root)) return;
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
            !isElement(el) ||
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
        const under = highlightedSegmentAt(elementAt(root, pointerX, pointerY));
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
    doc.addEventListener('selectionchange', onSelectionChange);
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('pointerup', onPointerUp, true);
    doc.addEventListener('pointercancel', putBackTabindex, true);
    doc.addEventListener('contextmenu', putBackTabindex, true);
    win?.addEventListener('blur', putBackTabindex);
    doc.addEventListener('keyup', onKeyUp, true);
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', onDblclick);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);

    return () => {
        clearTouchTimer();
        clearReleaseTimer();
        doc.removeEventListener('selectionchange', onSelectionChange);
        doc.removeEventListener('pointerdown', onPointerDown, true);
        doc.removeEventListener('pointerup', onPointerUp, true);
        doc.removeEventListener('pointercancel', putBackTabindex, true);
        doc.removeEventListener('contextmenu', putBackTabindex, true);
        win?.removeEventListener('blur', putBackTabindex);
        doc.removeEventListener('keyup', onKeyUp, true);
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
