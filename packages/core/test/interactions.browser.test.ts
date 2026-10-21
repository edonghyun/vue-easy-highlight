// attachInteractions behaviors that sit outside the adapter contract suite
// (packages/adapter-contract): de-duplication, the modifier and touch rules,
// offset clamping, key repeat, nested marks, detach, options changed after
// attaching. Nothing here waits a fixed time: positives await the real event
// or poll for it, absences run the gesture's confirmation through `settle()`
// and pair it with a live positive control, and the touch delay runs on fake
// timers.
import {
    TEXT,
    a,
    b,
    charPosition,
    clearSelectionAndWait,
    detailsOf,
    eventsOf,
    givenFakeTimeouts,
    givenPointerOutsideRoots,
    keyUp,
    partialOverlap,
    pointer,
    release,
    segmentElement,
    selectAndWait,
    selectEvent,
    settle,
} from '@overlapmark/adapter-contract';
import type { AdapterEvent } from '@overlapmark/adapter-contract';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../src/styles.css';
import { computeSegments } from '../src';
import { attachInteractions, createRangeFromOffsets } from '../src/dom';
import { renderInto } from './helpers/mount';

/** The settings `attachInteractions` reads live; tests may change them after attaching. */
interface Settings {
    minSelectionLength?: number;
    touchSelectionDelay?: number;
}

interface Recorder {
    /** Every event the handlers received, in order. */
    readonly events: AdapterEvent[];
    detach(): void;
}

/**
 * Renders `partialOverlap` into a root at the end of the body, optionally
 * followed by a text node outside it. Clearing the selection (and waiting for
 * its `selectionchange`) and removing the nodes are registered here.
 */
function givenRoot(options: { after?: string } = {}): HTMLElement {
    const root = document.createElement('div');
    renderInto(root, TEXT, partialOverlap.highlights);
    document.body.append(root);
    const after =
        options.after === undefined
            ? null
            : document.body.appendChild(document.createTextNode(options.after));
    onTestFinished(async () => {
        await clearSelectionAndWait();
        root.remove();
        after?.remove();
    });
    return root;
}

/**
 * Attaches interactions to `root` with every handler recording into `events`.
 * `settings` is forwarded live, so a test can change it after attaching.
 * Detached when the test finishes, unless the test already did.
 */
function givenRecorder(root: HTMLElement, settings: Settings = {}): Recorder {
    const segments = computeSegments(TEXT, [...partialOverlap.highlights]);
    const events: AdapterEvent[] = [];
    const detach = attachInteractions(root, {
        getText: () => TEXT,
        getSegments: () => segments,
        get minSelectionLength() {
            return settings.minSelectionLength;
        },
        get touchSelectionDelay() {
            return settings.touchSelectionDelay;
        },
        onSelect: (detail) => events.push({ type: 'select', detail }),
        onClick: (detail) => events.push({ type: 'click', detail }),
        onDblclick: (detail) => events.push({ type: 'dblclick', detail }),
        onHover: (detail) => events.push({ type: 'hover', detail }),
    });
    onTestFinished(detach);
    return { events, detach };
}

/** A root rendering `partialOverlap` with a recorder attached. */
function givenInteractiveRoot(
    options: { settings?: Settings; after?: string } = {},
): { root: HTMLElement; events: AdapterEvent[] } {
    const root = givenRoot({ after: options.after });
    const { events } = givenRecorder(root, options.settings);
    return { root, events };
}

function selectsOf(events: AdapterEvent[]): AdapterEvent[] {
    return eventsOf({ events }, 'select');
}

/** The recorded hover events as `type:segmentStart`. */
function hoverTrail(events: AdapterEvent[]): string[] {
    return detailsOf({ events }, 'hover').map(
        (d) => `${d.type}:${d.segment.start}`,
    );
}

function keydown(
    target: Element,
    key: string,
    init: KeyboardEventInit = {},
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

describe('attachInteractions: select on release', () => {
    it('emits select after a real mouse drag', async () => {
        const { root, events } = givenInteractiveRoot();
        const from = charPosition(root, 1);
        const to = charPosition(root, 18);

        await userEvent.dragAndDrop(
            page.elementLocator(from.el),
            page.elementLocator(to.el),
            {
                sourcePosition: {
                    x: from.position.x - 3,
                    y: from.position.y,
                },
                targetPosition: to.position,
            },
        );

        await expect.poll(() => selectsOf(events)).toHaveLength(1);
        const [d] = detailsOf({ events }, 'select');
        expect(d.text).toBe(TEXT.slice(d.start, d.end));
        expect(d.start).toBe(1);
        expect(d.end).toBeGreaterThanOrEqual(18);
    });

    it('emits select for the word a double click selects', async () => {
        const { root, events } = givenInteractiveRoot();
        const { el, position } = charPosition(root, 10);

        await userEvent.dblClick(el, { position });

        await expect
            .poll(() => selectsOf(events))
            .toEqual([selectEvent(6, 15, [a, b])]);
    });

    it('does not emit a released selection again on the following keyup', async () => {
        const { root, events } = givenInteractiveRoot();
        await selectAndWait(root, 8, 18);
        release();
        await expect.poll(() => selectsOf(events)).toHaveLength(1);

        settle(() => keyUp('Shift'));

        expect(selectsOf(events)).toEqual([selectEvent(8, 18, [a, b])]);
        // Live positive control: the same keyup after selecting a different range.
        await selectAndWait(root, 2, 5);
        settle(() => keyUp('Shift'));
        expect(selectsOf(events)).toEqual([
            selectEvent(8, 18, [a, b]),
            selectEvent(2, 5, [a]),
        ]);
    });

    it('does not emit the same range selected again without a change in between', async () => {
        const { root, events } = givenInteractiveRoot();
        await selectAndWait(root, 8, 18);
        release();
        await expect.poll(() => selectsOf(events)).toHaveLength(1);

        await selectAndWait(root, 8, 18);
        settle(release);

        expect(selectsOf(events)).toEqual([selectEvent(8, 18, [a, b])]);
        // Live positive control: the same release after selecting a different range.
        await selectAndWait(root, 2, 5);
        settle(release);
        expect(selectsOf(events)).toEqual([
            selectEvent(8, 18, [a, b]),
            selectEvent(2, 5, [a]),
        ]);
    });

    it('emits the same range again once the selection was cleared in between', async () => {
        const { root, events } = givenInteractiveRoot();
        await selectAndWait(root, 8, 18);
        release();
        await expect.poll(() => selectsOf(events)).toHaveLength(1);
        await clearSelectionAndWait();

        await selectAndWait(root, 8, 18);
        release();

        await expect
            .poll(() => selectsOf(events))
            .toEqual([selectEvent(8, 18, [a, b]), selectEvent(8, 18, [a, b])]);
    });
});

describe('attachInteractions: select on keyup', () => {
    it.each(['shiftKey', 'ctrlKey', 'metaKey', 'altKey'])(
        'waits for %s to be released before confirming',
        async (modifier) => {
            const { root, events } = givenInteractiveRoot();
            await selectAndWait(root, 2, 6);

            settle(() => keyUp('ArrowRight', { [modifier]: true }));

            expect(selectsOf(events)).toEqual([]);
            // Live positive control: the keyup of the modifier itself.
            settle(() => keyUp('Shift'));
            expect(selectsOf(events)).toEqual([selectEvent(2, 6, [a])]);
        },
    );

    it('emits the text inside the root for select-all once the modifier is released', async () => {
        const { events } = givenInteractiveRoot({ after: ' and beyond' });

        await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');

        expect(window.getSelection()!.toString()).toContain('and beyond');
        await expect
            .poll(() => selectsOf(events))
            .toEqual([selectEvent(0, TEXT.length, [a, b])]);
    });

    it('emits the part inside the root when Shift+Arrow extends the selection past its end', async () => {
        const { root, events } = givenInteractiveRoot({ after: 'beyond' });
        // Headless Chromium only extends an existing (non-collapsed) selection
        // with Shift+Arrow in non-editable content, so start from one character.
        await selectAndWait(root, 27, 28);

        await userEvent.keyboard(
            '{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}',
        );

        expect(window.getSelection()!.focusNode).toBe(root.nextSibling);
        await expect
            .poll(() => selectsOf(events))
            .toEqual([selectEvent(27, TEXT.length, [])]);
    });
});

describe('attachInteractions: select on touch', () => {
    it('emits a touch selection once touchSelectionDelay passes, without pointerup', async () => {
        const { root, events } = givenInteractiveRoot({
            settings: { touchSelectionDelay: 50 },
        });
        givenFakeTimeouts();
        pointer('pointerdown', root, { pointerType: 'touch' });

        await selectAndWait(root, 8, 18);

        vi.advanceTimersByTime(49);
        expect(selectsOf(events)).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(selectsOf(events)).toEqual([selectEvent(8, 18, [a, b])]);
    });

    it('restarts the wait when the touch selection changes before it is confirmed', async () => {
        const { root, events } = givenInteractiveRoot({
            settings: { touchSelectionDelay: 50 },
        });
        givenFakeTimeouts();
        pointer('pointerdown', root, { pointerType: 'touch' });
        await selectAndWait(root, 8, 18);
        vi.advanceTimersByTime(30);

        await selectAndWait(root, 8, 20);

        // Without the restart the first wait would end 20 ms from here.
        vi.advanceTimersByTime(49);
        expect(selectsOf(events)).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(selectsOf(events)).toEqual([selectEvent(8, 20, [a, b])]);
    });

    it('emits the adjusted range after a touch selection was confirmed', async () => {
        const { root, events } = givenInteractiveRoot({
            settings: { touchSelectionDelay: 50 },
        });
        givenFakeTimeouts();
        pointer('pointerdown', root, { pointerType: 'touch' });
        await selectAndWait(root, 8, 18);
        vi.advanceTimersByTime(50);

        await selectAndWait(root, 8, 20);
        vi.advanceTimersByTime(50);

        expect(selectsOf(events)).toEqual([
            selectEvent(8, 18, [a, b]),
            selectEvent(8, 20, [a, b]),
        ]);
    });
});

describe('attachInteractions: settings changed after attaching', () => {
    it('applies a changed minSelectionLength to the next selection', async () => {
        const settings: Settings = { minSelectionLength: 5 };
        const { root, events } = givenInteractiveRoot({ settings });
        await selectAndWait(root, 2, 4);
        settle(release);
        expect(selectsOf(events)).toEqual([]);

        settings.minSelectionLength = 1;
        await selectAndWait(root, 2, 5);
        release();

        await expect
            .poll(() => selectsOf(events))
            .toEqual([selectEvent(2, 5, [a])]);
    });

    it('applies a changed touchSelectionDelay to the next touch selection', async () => {
        const settings: Settings = { touchSelectionDelay: 5000 };
        const { root, events } = givenInteractiveRoot({ settings });
        givenFakeTimeouts();

        settings.touchSelectionDelay = 40;
        pointer('pointerdown', root, { pointerType: 'touch' });
        await selectAndWait(root, 8, 18);

        vi.advanceTimersByTime(39);
        expect(selectsOf(events)).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(selectsOf(events)).toEqual([selectEvent(8, 18, [a, b])]);
    });
});

describe('attachInteractions: click', () => {
    it('reports segment.start when the point is outside the root', () => {
        const { root, events } = givenInteractiveRoot();

        segmentElement(root, 6).dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                clientX: -100,
                clientY: -100,
            }),
        );

        expect(detailsOf({ events }, 'click').map((d) => d.offset)).toEqual([
            6,
        ]);
    });

    it('clamps the offset into the clicked segment when the point is on another one', () => {
        const { root, events } = givenInteractiveRoot();
        const r = createRangeFromOffsets(root, 2, 3)!.getBoundingClientRect();

        segmentElement(root, 6).dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                clientX: r.left + r.width / 2,
                clientY: r.top + r.height / 2,
            }),
        );

        expect(detailsOf({ events }, 'click').map((d) => d.offset)).toEqual([
            6,
        ]);
    });

    it('keeps preventing the default action of a held Space', () => {
        const { root } = givenInteractiveRoot();
        const el = segmentElement(root, 6);
        keydown(el, ' ');

        const repeat = keydown(el, ' ', { repeat: true });

        expect(repeat.defaultPrevented).toBe(true);
    });
});

describe('attachInteractions: hover', () => {
    it('emits nothing while the pointer moves between the nested marks of one segment', async () => {
        await givenPointerOutsideRoots();
        const { root, events } = givenInteractiveRoot();
        const outer = segmentElement(root, 6);
        const inner = outer.querySelector('mark')!;
        expect(inner.hasAttribute('data-om-start')).toBe(false);

        pointer('pointerover', outer, {
            relatedTarget: segmentElement(root, 0),
        });
        pointer('pointerout', outer, { relatedTarget: inner });
        pointer('pointerover', inner, { relatedTarget: outer });
        pointer('pointerout', inner, { relatedTarget: outer });
        pointer('pointerover', outer, { relatedTarget: inner });

        expect(hoverTrail(events)).toEqual(['enter:6']);
    });

    it.each(['touch', 'pen'])(
        'ignores a %s pointer moving between segments',
        async (pointerType) => {
            await givenPointerOutsideRoots();
            const { root, events } = givenInteractiveRoot();
            const from = segmentElement(root, 6);
            const to = segmentElement(root, 15);
            pointer('pointerover', from);

            pointer('pointerout', from, { relatedTarget: to, pointerType });
            pointer('pointerover', to, { relatedTarget: from, pointerType });

            expect(hoverTrail(events)).toEqual(['enter:6']);
            // Live positive control: the same moves by the mouse.
            pointer('pointerout', from, { relatedTarget: to });
            pointer('pointerover', to, { relatedTarget: from });
            expect(hoverTrail(events)).toEqual([
                'enter:6',
                'leave:6',
                'enter:15',
            ]);
        },
    );

    it('emits leave when the pointer moves out of the root', async () => {
        await givenPointerOutsideRoots();
        const { root, events } = givenInteractiveRoot();
        const inner = segmentElement(root, 6).querySelector('mark')!;
        pointer('pointerover', inner);

        pointer('pointerout', inner, { relatedTarget: document.body });

        expect(hoverTrail(events)).toEqual(['enter:6', 'leave:6']);
    });

    it('emits leave when the pointer leaves the window', async () => {
        await givenPointerOutsideRoots();
        const { root, events } = givenInteractiveRoot();
        const inner = segmentElement(root, 6).querySelector('mark')!;
        pointer('pointerover', inner);

        pointer('pointerout', inner, { relatedTarget: null });

        expect(hoverTrail(events)).toEqual(['enter:6', 'leave:6']);
    });

    it('emits no further leave on detach once the pointer has left', async () => {
        await givenPointerOutsideRoots();
        const root = givenRoot();
        const recorder = givenRecorder(root);
        const el = segmentElement(root, 6);
        pointer('pointerover', el);
        pointer('pointerout', el, { relatedTarget: document.body });

        recorder.detach();

        expect(hoverTrail(recorder.events)).toEqual(['enter:6', 'leave:6']);
    });
});

describe('attachInteractions: after detach', () => {
    it('drops a pending touch confirmation', async () => {
        const root = givenRoot();
        const live = givenRecorder(root, { touchSelectionDelay: 30 });
        const detached = givenRecorder(root, { touchSelectionDelay: 30 });
        givenFakeTimeouts();
        pointer('pointerdown', root, { pointerType: 'touch' });
        await selectAndWait(root, 1, 4);

        detached.detach();
        vi.advanceTimersByTime(30);

        expect(detached.events).toEqual([]);
        // Live positive control: the instance still attached to the same root.
        expect(selectsOf(live.events)).toEqual([selectEvent(1, 4, [a])]);
    });

    // A second recorder on the same root receives every gesture; it proves the
    // gesture reached the root, so the detached recorder's silence means
    // something.
    it.each([
        {
            gesture: 'a released mouse selection',
            type: 'select' as const,
            act: async (root: HTMLElement) => {
                await selectAndWait(root, 8, 18);
                settle(release);
            },
        },
        {
            gesture: 'a keyboard selection on keyup',
            type: 'select' as const,
            act: async (root: HTMLElement) => {
                await selectAndWait(root, 8, 18);
                settle(() => keyUp('Shift'));
            },
        },
        {
            gesture: 'a click',
            type: 'click' as const,
            act: async (root: HTMLElement) => {
                const { el, position } = charPosition(root, 10);
                await userEvent.click(el, { position });
            },
        },
        {
            gesture: 'a double click',
            type: 'dblclick' as const,
            act: async (root: HTMLElement) => {
                const { el, position } = charPosition(root, 10);
                await userEvent.dblClick(el, { position });
            },
        },
        {
            gesture: 'Enter on a focused segment',
            type: 'click' as const,
            act: async (root: HTMLElement) => {
                segmentElement(root, 6).focus();
                await userEvent.keyboard('{Enter}');
            },
        },
        {
            gesture: 'a mouse hover',
            type: 'hover' as const,
            act: async (root: HTMLElement) => {
                await userEvent.hover(segmentElement(root, 15));
            },
        },
    ])('records nothing for $gesture', async ({ type, act }) => {
        await givenPointerOutsideRoots();
        const root = givenRoot();
        const live = givenRecorder(root);
        const detached = givenRecorder(root);
        detached.detach();

        await act(root);

        expect(detached.events).toEqual([]);
        expect(eventsOf(live, type)).toHaveLength(1);
    });
});
