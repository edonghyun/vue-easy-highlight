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
    /** Minimum selection length (code units) for `onSelect`. Default 1. */
    minSelectionLength?: number;
    /** Touch selections are confirmed after this many ms without change. Default 500. */
    touchSelectionDelay?: number;
}

const SEG = '[data-om-start]';

/** Attaches the interaction listeners to `root`; returns `detach`. */
export function attachInteractions<T>(
    root: HTMLElement,
    options: InteractionOptions<T>,
): () => void {
    const minLength = options.minSelectionLength ?? 1;
    const touchDelay = options.touchSelectionDelay ?? 500;

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
        if (end - start < minLength) return;
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
            touchTimer = setTimeout(confirm, touchDelay);
        }
    };

    // `selectionchange` is queued asynchronously, so the change caused by the
    // last key press (or the last drag step) can arrive after its keyup/pointerup.
    // Confirm on the next task so that change is already accounted for.
    const confirmSoon = (): void => {
        clearReleaseTimer();
        releaseTimer = setTimeout(confirm, 0);
    };

    const onPointerDown = (e: PointerEvent): void => {
        lastPointerType = e.pointerType;
    };

    const onPointerUp = (): void => {
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
        e.preventDefault();
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

    const leave = (e: PointerEvent): void => {
        if (!hovered) return;
        const { segment } = hovered;
        hovered = null;
        options.onHover?.({
            type: 'leave',
            segment,
            highlights: segment.highlights,
            event: e,
        });
    };

    const onPointerOver = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return;
        const next = highlightedSegmentAt(e.target);
        if (next?.el === hovered?.el) return;
        leave(e);
        if (!next) return;
        hovered = next;
        options.onHover?.({
            type: 'enter',
            segment: next.segment,
            highlights: next.segment.highlights,
            event: e,
        });
    };

    const onPointerOut = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return;
        // Moving between nested marks of the same segment is not a leave.
        if (highlightedSegmentAt(e.relatedTarget)?.el === hovered?.el) return;
        leave(e);
    };

    // ---- wiring ----------------------------------------------------------
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keyup', confirmSoon, true);
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
        document.removeEventListener('keyup', confirmSoon, true);
        root.removeEventListener('click', onClick);
        root.removeEventListener('dblclick', onDblclick);
        root.removeEventListener('keydown', onKeyDown);
        root.removeEventListener('pointerover', onPointerOver);
        root.removeEventListener('pointerout', onPointerOut);
        hovered = null;
        pending = false;
        last = null;
    };
}
