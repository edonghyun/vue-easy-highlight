// User gestures for the contract suite, synchronized on real events instead of
// fixed waits. Nothing here sleeps: a helper either awaits the event it causes,
// or (`settle`) runs the confirmation it schedules before returning.
import { createRangeFromOffsets } from '@overlapmark/core/dom';
import { onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

/** Resolves on the next `selectionchange`; create it before changing the selection. */
export function nextSelectionChange(): Promise<void> {
    return new Promise((resolve) =>
        document.addEventListener('selectionchange', () => resolve(), {
            once: true,
        }),
    );
}

/**
 * Replaces the document selection with `range` and resolves once the
 * `selectionchange` it causes has been delivered, so every listener has seen
 * the new selection.
 */
export async function setSelectionAndWait(range: Range): Promise<void> {
    const changed = nextSelectionChange();
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    await changed;
}

/** Selects the text offsets [start, end) of `root`, then waits as `setSelectionAndWait`. */
export async function selectAndWait(
    root: Element,
    start: number,
    end: number,
): Promise<void> {
    const range = createRangeFromOffsets(root, start, end);
    if (!range) throw new Error(`selectAndWait: no range for ${start}..${end}`);
    await setSelectionAndWait(range);
}

/** Clears the selection; when there was one, resolves after its `selectionchange`. */
export async function clearSelectionAndWait(): Promise<void> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const changed = nextSelectionChange();
    selection.removeAllRanges();
    await changed;
}

/** Dispatches a synthetic pointer event (mouse unless `init.pointerType` says otherwise). */
export function pointer(
    type: string,
    target: EventTarget,
    init: PointerEventInit = {},
): void {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerType: 'mouse',
            ...init,
        }),
    );
}

/** Ends a mouse drag: a pointerup on the document, which schedules the selection's confirmation. */
export function release(): void {
    pointer('pointerup', document);
}

/** Dispatches a keyup on the document; with no modifier flag set it schedules confirmation. */
export function keyUp(key: string, init: KeyboardEventInit = {}): void {
    document.dispatchEvent(new KeyboardEvent('keyup', { key, ...init }));
}

/**
 * The barrier for absence checks. Runs `gesture` (e.g. `release`) and every
 * timer it schedules before returning, so whatever the gesture can emit has
 * been recorded when `settle` returns and an empty result means "nothing was
 * emitted", not "not yet". Pair each absence with a live positive control: the
 * same gesture on an input that must emit.
 *
 * Only `setTimeout`/`clearTimeout` are faked, and only during the call. Do not
 * use it inside a test that already runs on fake timers.
 */
export function settle(gesture: () => void): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
        gesture();
        vi.runOnlyPendingTimers();
    } finally {
        vi.useRealTimers();
    }
}

/**
 * Fakes `setTimeout`/`clearTimeout` for the rest of the test, for the touch
 * settle delay. Real events (`selectionchange`) still arrive; do not combine
 * with `expect.poll` or `userEvent`, which rely on real timers.
 */
export function useFakeTimeouts(): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
        vi.useRealTimers();
    });
}

/** The outermost element of the segment that starts at `start`. */
export function segmentElement(root: Element, start: number): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-om-start="${start}"]`);
    if (!el) throw new Error(`segmentElement: no segment starts at ${start}`);
    return el;
}

/** The segment element containing character `i`, and the center of that character relative to it. */
export function charPosition(
    root: Element,
    i: number,
): { el: HTMLElement; position: { x: number; y: number } } {
    const range = createRangeFromOffsets(root, i, i + 1);
    if (!range) throw new Error(`charPosition: no range for ${i}`);
    const rect = range.getBoundingClientRect();
    const node = range.startContainer;
    const el = (
        node instanceof Element ? node : node.parentElement!
    ).closest<HTMLElement>('[data-om-start]')!;
    const box = el.getBoundingClientRect();
    return {
        el,
        position: {
            x: rect.left + rect.width / 2 - box.left,
            y: rect.top + rect.height / 2 - box.top,
        },
    };
}

/**
 * Moves the real mouse onto a fresh element outside every root, so a pointer
 * left over from an earlier test cannot sit on a highlight. Call it before
 * mounting: the element stays above the roots mounted after it.
 */
export async function givenPointerOutsideRoots(): Promise<void> {
    const neutral = document.createElement('p');
    neutral.textContent = 'outside every root';
    document.body.prepend(neutral);
    onTestFinished(() => neutral.remove());
    await userEvent.hover(neutral);
}
