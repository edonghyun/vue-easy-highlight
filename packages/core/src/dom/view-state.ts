/**
 * The one rule set for what a re-render keeps of the user's selection and
 * keyboard focus inside an adapter's root. Adapters capture before they patch
 * the DOM and restore right after, in the same synchronous flush.
 */
import {
    createRangeFromOffsets,
    getSelectionOffsets,
    segmentElementAt,
} from './offsets';
import type { TextRange } from './offsets';

/**
 * What `captureViewState` recorded. Opaque to adapters: hand it to
 * `restoreViewState` unread. Its fields are not part of the public contract.
 */
export interface ViewState {
    /** The selection inside the root, in text offsets, or `null`. */
    readonly selection: TextRange | null;
    /** Start offset of the focused segment of the root, or `null`. */
    readonly focusedOffset: number | null;
}

export interface RestoreViewStateOptions {
    /** Whether the re-render replaced the text (compare old and new `text`). */
    textChanged: boolean;
}

const SEG = '[data-om-start]';

/** Records the selection and the focused segment inside `root`, before a re-render. */
export function captureViewState(root: Element): ViewState {
    return {
        selection: getSelectionOffsets(root),
        focusedOffset: focusedSegmentStart(root),
    };
}

/**
 * Puts back what `captureViewState` recorded, after the re-render.
 *
 * - The selection is restored by text offsets. When the text changed it is
 *   cleared instead: the same offsets would now select other characters.
 * - Focus goes to the segment now covering the start of the segment that had
 *   it, if that segment is highlighted and focusable. Otherwise focus is not
 *   moved.
 *
 * Selections and focus outside `root` are never touched.
 */
export function restoreViewState(
    root: Element,
    state: ViewState,
    options: RestoreViewStateOptions,
): void {
    restoreSelection(root, state.selection, options.textChanged);
    restoreFocus(root, state.focusedOffset);
}

function focusedSegmentStart(root: Element): number | null {
    const active = document.activeElement;
    if (!active || !root.contains(active)) return null;
    const segment = active.closest(SEG);
    if (!segment || !root.contains(segment)) return null;
    const start = Number(segment.getAttribute('data-om-start'));
    return Number.isFinite(start) ? start : null;
}

function restoreSelection(
    root: Element,
    saved: TextRange | null,
    textChanged: boolean,
): void {
    const selection = window.getSelection();
    if (!saved || !selection) return;
    if (textChanged) {
        selection.removeAllRanges();
        return;
    }
    const range = createRangeFromOffsets(root, saved.start, saved.end);
    if (!range) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function restoreFocus(root: Element, focusedOffset: number | null): void {
    if (focusedOffset === null) return;
    const target = segmentElementAt(root, focusedOffset);
    // Only highlighted segments carry tabindex, and only when focusable.
    if (!(target instanceof HTMLElement) || !target.matches(`${SEG}[tabindex]`))
        return;
    if (document.activeElement !== target)
        target.focus({ preventScroll: true });
}
