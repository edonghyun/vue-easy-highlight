/**
 * The one rule set for what a re-render keeps of the user's selection and
 * keyboard focus inside an adapter's root. Adapters capture before they patch
 * the DOM and restore right after, in the same synchronous flush. Whether the
 * text changed is read from the DOM on both sides, so adapters keep no
 * "previous text" of their own.
 */
import {
    createRangeFromOffsets,
    getSelectionOffsets,
    renderedText,
    segmentElementAt,
} from './offsets';
import type { TextRange } from './offsets';
import { activeElementOf, isElement, selectionOf } from './tree';

/**
 * What `captureViewState` recorded. Opaque to adapters: hand it to
 * `restoreViewState` unread.
 */
export interface ViewState {
    /** @internal The selection inside the root, in text offsets, or `null`. */
    readonly selection: TextRange | null;
    /** @internal Start offset of the focused segment of the root, or `null`. */
    readonly focusedOffset: number | null;
    /**
     * @internal The text rendered in the root, recorded only when there is a
     * selection or focus to restore; otherwise `null`.
     */
    readonly text: string | null;
}

const SEG = '[data-om-start]';

/** Records the selection and the focused segment inside `root`, before a re-render. */
export function captureViewState(root: Element): ViewState {
    const selection = getSelectionOffsets(root);
    const focusedOffset = focusedSegmentStart(root);
    const restorable = selection !== null || focusedOffset !== null;
    return {
        selection,
        focusedOffset,
        text: restorable ? renderedText(root) : null,
    };
}

/**
 * Puts back what `captureViewState` recorded, after the re-render.
 *
 * - The selection is restored by text offsets; one already at those offsets
 *   is left as it is. When the rendered text changed it is cleared instead:
 *   the same offsets would now select other characters.
 * - Focus goes to the segment now covering the start of the segment that had
 *   it, if that segment is highlighted and focusable. When the text changed,
 *   only a segment starting at that same offset qualifies. Otherwise focus is
 *   taken off the root's old segment and not moved anywhere.
 *
 * Selections and focus outside `root` are never touched.
 */
export function restoreViewState(root: Element, state: ViewState): void {
    if (state.text === null) return;
    const textChanged = renderedText(root) !== state.text;
    restoreSelection(root, state.selection, textChanged);
    restoreFocus(root, state.focusedOffset, textChanged);
}

function focusedSegmentStart(root: Element): number | null {
    const active = activeElementOf(root);
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
    const selection = selectionOf(root);
    if (!saved || !selection) return;
    if (textChanged) {
        selection.removeAllRanges();
        return;
    }
    // Re-adding a selection still in place would reset its direction and
    // fire a selectionchange, which restarts a pending touch confirmation.
    const current = getSelectionOffsets(root, selection);
    if (current && current.start === saved.start && current.end === saved.end)
        return;
    const range = createRangeFromOffsets(root, saved.start, saved.end);
    if (!range) return;
    // Not addRange, which WebKit ignores for a range inside a shadow root.
    selection.setBaseAndExtent(
        range.startContainer,
        range.startOffset,
        range.endContainer,
        range.endOffset,
    );
}

function restoreFocus(
    root: Element,
    focusedOffset: number | null,
    textChanged: boolean,
): void {
    if (focusedOffset === null) return;
    const covering = segmentElementAt(root, focusedOffset);
    // In a new text the covering segment holds other characters; only one
    // starting at the same offset still counts as the focused segment.
    const qualifies =
        !textChanged ||
        covering?.getAttribute('data-om-start') === String(focusedOffset);
    // Only highlighted segments carry tabindex, and only when focusable.
    if (qualifies && covering?.matches(`${SEG}[tabindex]`)) {
        if (activeElementOf(root) !== covering)
            (covering as HTMLElement).focus({ preventScroll: true });
        return;
    }
    // A patch in place can leave focus on an element that is no longer a
    // focusable segment; not every browser drops it by itself.
    const active = activeElementOf(root);
    if (isElement(active) && root.contains(active))
        (active as HTMLElement).blur();
}
