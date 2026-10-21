/**
 * The adapter contract suite (spec §4.6, §6, §9): every adapter registers it
 * with a factory and must pass it unchanged. Differences between adapters live
 * only in the factory, never in `if (name === …)` inside the suite.
 *
 * This package imports `@overlapmark/core` without declaring it: core's own
 * tests run this suite, so a declared dependency would be a workspace cycle.
 * Each consumer resolves `@overlapmark/core` (and `/dom`) to core's sources
 * through its Vitest aliases and tsconfig paths, so the suite and the adapter
 * share one module instance.
 */
import type {
    HoverDetail,
    PointDetail,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import {
    createRangeFromOffsets,
    getSelectionOffsets,
    getTextLength,
} from '@overlapmark/core/dom';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
    TEXT,
    a,
    b,
    c,
    codePointRanges,
    fixtures,
    partialOverlap,
} from './fixtures';
import {
    charPosition,
    clearSelectionAndWait,
    givenPointerOutsideRoots,
    keyUp,
    pointer,
    release,
    segmentElement,
    givenFakeTimeouts,
    selectAndWait,
    setSelection,
    setSelectionAndWait,
    settle,
} from './gestures';
import { expectedTree } from './reference-tree';
import { serializeRoot } from './serialize';
import type {
    AdapterEvent,
    AdapterFactory,
    ContractProps,
    MountedAdapter,
} from './types';

export type { AdapterEvent, AdapterFactory, ContractProps, MountedAdapter };
export { expectedTree } from './reference-tree';
export { serializeRoot } from './serialize';
export type { ElementTree, RootTree, TreeNode } from './serialize';
export * from './fixtures';
export * from './gestures';

type DetailOf<K extends AdapterEvent['type']> = K extends 'select'
    ? SelectDetail
    : K extends 'hover'
      ? HoverDetail
      : PointDetail;

/** Anything that records adapter events: a mounted adapter, or a bare recorder. */
type EventSource = Pick<MountedAdapter, 'events'>;

/**
 * The recorded events of one type, in order. Assertions look at one type at a
 * time: real pointer gestures also cross segments and emit hover on the way.
 */
export function eventsOf(
    source: EventSource,
    type: AdapterEvent['type'],
): AdapterEvent[] {
    return source.events.filter((e) => e.type === type);
}

/** The details of `eventsOf(source, type)`. */
export function detailsOf<K extends AdapterEvent['type']>(
    source: EventSource,
    type: K,
): DetailOf<K>[] {
    return eventsOf(source, type).map((e) => e.detail as DetailOf<K>);
}

/** The `select` event expected for [start, end) of `TEXT`. */
export function selectEvent(
    start: number,
    end: number,
    highlights: ContractProps['highlights'],
): AdapterEvent {
    return {
        type: 'select',
        detail: {
            start,
            end,
            text: TEXT.slice(start, end),
            rect: expect.any(DOMRect),
            highlights: [...highlights],
        },
    };
}

const strategies: { strategy: Strategy }[] = [
    { strategy: 'layers' },
    { strategy: 'depth' },
];

export function defineAdapterContract(factory: AdapterFactory): void {
    const { name } = factory;

    /**
     * Mounts `props` in a fresh host at the end of the body. Unmounting, host
     * removal and clearing the selection are registered here, so tests never
     * clean up by hand.
     */
    async function givenAdapter(props: ContractProps): Promise<MountedAdapter> {
        const host = document.createElement('div');
        document.body.append(host);
        const mounted = await factory.mount(host, props);
        let live = true;
        onTestFinished(async () => {
            if (live) await mounted.unmount();
            host.remove();
            await clearSelectionAndWait();
        });
        return {
            get root() {
                return mounted.root;
            },
            get events() {
                return mounted.events;
            },
            update: (next) => mounted.update(next),
            unmount: async () => {
                live = false;
                await mounted.unmount();
            },
        };
    }

    /** A text node between the instances mounted before and after it. */
    function givenTextOutsideRoots(text: string): Text {
        const node = document.createTextNode(text);
        document.body.append(node);
        onTestFinished(() => node.remove());
        return node;
    }

    describe(`${name} — DOM structure contract (§4.6)`, () => {
        describe.each(strategies)(
            'with the $strategy strategy',
            ({ strategy }) => {
                it.each(fixtures)(
                    'renders the core render model for the $name fixture',
                    async (fixture) => {
                        const props = { ...fixture, strategy };

                        const { root } = await givenAdapter(props);

                        expect(serializeRoot(root)).toEqual(
                            expectedTree(props),
                        );
                    },
                );

                it('renders the text exactly once', async () => {
                    const { root } = await givenAdapter({
                        ...partialOverlap,
                        strategy,
                    });

                    expect(root.textContent).toBe(TEXT);
                });

                it('gives getTextLength the source text length', async () => {
                    const { root } = await givenAdapter({
                        ...partialOverlap,
                        strategy,
                    });

                    expect(getTextLength(root)).toBe(TEXT.length);
                });
            },
        );

        it('makes every highlighted segment focusable by default', async () => {
            const { root } = await givenAdapter(partialOverlap);

            const highlighted = [...root.querySelectorAll('[data-depth]')];

            expect(highlighted).toHaveLength(3);
            for (const el of highlighted)
                expect(el.getAttribute('tabindex')).toBe('0');
        });

        it('renders no tabindex when focusable is false', async () => {
            const { root } = await givenAdapter({
                ...partialOverlap,
                focusable: false,
            });

            expect(root.querySelectorAll('[data-depth]')).toHaveLength(3);
            expect(root.querySelectorAll('[tabindex]')).toHaveLength(0);
        });
    });

    describe(`${name} — offset contract`, () => {
        describe.each(strategies)(
            'with the $strategy strategy',
            ({ strategy }) => {
                const props = { ...partialOverlap, strategy };
                const ranges = codePointRanges(TEXT);

                it('maps a selection inside nested marks to string indices', async () => {
                    const { root } = await givenAdapter(props);

                    setSelection(createRangeFromOffsets(root, 8, 18)!);

                    expect(getSelectionOffsets(root)).toEqual({
                        start: 8,
                        end: 18,
                    });
                    expect(window.getSelection()!.toString()).toBe(
                        TEXT.slice(8, 18),
                    );
                });

                it('maps a selection across segments to string indices', async () => {
                    const { root } = await givenAdapter(props);

                    setSelection(createRangeFromOffsets(root, 3, 20)!);

                    expect(getSelectionOffsets(root)).toEqual({
                        start: 3,
                        end: 20,
                    });
                });

                it('creates a range whose text matches the source slice for every start/end pair', async () => {
                    const { root } = await givenAdapter(props);
                    expect(ranges.length).toBeGreaterThan(0);

                    for (const [start, end] of ranges) {
                        const range = createRangeFromOffsets(root, start, end)!;
                        expect(range.toString(), `${start}..${end}`).toBe(
                            TEXT.slice(start, end),
                        );
                    }
                });

                it('maps the selected range back to the same offsets for every start/end pair', async () => {
                    const { root } = await givenAdapter(props);
                    expect(ranges.length).toBeGreaterThan(0);

                    for (const [start, end] of ranges) {
                        setSelection(createRangeFromOffsets(root, start, end)!);
                        expect(
                            getSelectionOffsets(root),
                            `${start}..${end}`,
                        ).toEqual({ start, end });
                    }
                });
            },
        );
    });

    describe(`${name} — event payloads (§6)`, () => {
        describe('select', () => {
            it('emits the offsets, text and overlapping highlights of a released selection', async () => {
                const adapter = await givenAdapter(partialOverlap);
                await selectAndWait(adapter.root, 8, 18);

                release();

                await expect
                    .poll(() => eventsOf(adapter, 'select'))
                    .toEqual([selectEvent(8, 18, [a, b])]);
            });

            it('passes on the highlight objects it was given', async () => {
                const adapter = await givenAdapter(partialOverlap);
                await selectAndWait(adapter.root, 8, 18);

                release();

                await expect
                    .poll(() => eventsOf(adapter, 'select'))
                    .toHaveLength(1);
                const [detail] = detailsOf(adapter, 'select');
                expect(detail.highlights[0]).toBe(a);
                expect(detail.highlights[1]).toBe(b);
            });

            it('reports the bounding rect of the selected text', async () => {
                const adapter = await givenAdapter(partialOverlap);
                await selectAndWait(adapter.root, 8, 18);

                release();

                await expect
                    .poll(() => eventsOf(adapter, 'select'))
                    .toHaveLength(1);
                const [detail] = detailsOf(adapter, 'select');
                expect(detail.rect.width).toBeGreaterThan(0);
            });

            it('ignores a selection shorter than minSelectionLength', async () => {
                const adapter = await givenAdapter({
                    ...partialOverlap,
                    minSelectionLength: 3,
                });
                await selectAndWait(adapter.root, 2, 4);

                settle(release);

                // Live positive control: a long enough selection, released the same way.
                await selectAndWait(adapter.root, 2, 8);
                settle(release);
                expect(eventsOf(adapter, 'select')).toEqual([
                    selectEvent(2, 8, [a, b]),
                ]);
            });

            it('emits a selection exactly minSelectionLength long', async () => {
                const adapter = await givenAdapter({
                    ...partialOverlap,
                    minSelectionLength: 3,
                });
                await selectAndWait(adapter.root, 2, 5);

                release();

                await expect
                    .poll(() => eventsOf(adapter, 'select'))
                    .toEqual([selectEvent(2, 5, [a])]);
            });

            it('emits a keyboard selection once, when the modifier key is released', async () => {
                const adapter = await givenAdapter({
                    ...partialOverlap,
                    minSelectionLength: 2,
                });
                // Headless Chromium only extends an existing (non-collapsed) selection
                // with Shift+Arrow in non-editable content, so start from one character.
                await selectAndWait(adapter.root, 0, 1);
                expect(eventsOf(adapter, 'select')).toEqual([]);

                await userEvent.keyboard(
                    '{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}',
                );

                // Arrow keyups with Shift held would emit 0..2, 0..3 and 0..4
                // first, so the final selection being the only event proves they did not.
                await expect
                    .poll(() => eventsOf(adapter, 'select'))
                    .toEqual([selectEvent(0, 5, [a])]);
            });

            it('ignores a selection made in another instance', async () => {
                const first = await givenAdapter(partialOverlap);
                const second = await givenAdapter(partialOverlap);
                await selectAndWait(second.root, 2, 9);

                settle(release);

                expect(eventsOf(first, 'select')).toEqual([]);
                expect(eventsOf(second, 'select')).toEqual([
                    selectEvent(2, 9, [a, b]),
                ]);
            });

            it('ignores a selection outside every instance', async () => {
                const first = await givenAdapter(partialOverlap);
                const outside = givenTextOutsideRoots('Elsewhere on the page');
                const second = await givenAdapter(partialOverlap);
                const range = document.createRange();
                range.setStart(outside, 0);
                range.setEnd(outside, 9);
                await setSelectionAndWait(range);

                settle(release);
                settle(() => keyUp('Shift'));

                // Live positive control: the same release after selecting inside `first`.
                await selectAndWait(first.root, 1, 3);
                settle(release);
                expect(eventsOf(first, 'select')).toEqual([
                    selectEvent(1, 3, [a]),
                ]);
                expect(eventsOf(second, 'select')).toEqual([]);
            });
        });

        describe('click and dblclick', () => {
            it('reports the offset and the covering highlights of a click on an overlap', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const { el, position } = charPosition(adapter.root, 10);

                await userEvent.click(el, { position });

                const clicks = detailsOf(adapter, 'click');
                expect(clicks).toEqual([
                    {
                        offset: 10,
                        segment: expect.objectContaining({ start: 6, end: 15 }),
                        highlights: [a, b],
                        event: expect.any(MouseEvent),
                    },
                ]);
                expect(clicks[0].event.type).toBe('click');
            });

            it('reports empty highlights for a click on plain text', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const { el, position } = charPosition(adapter.root, 26);

                await userEvent.click(el, { position });

                expect(detailsOf(adapter, 'click')).toEqual([
                    {
                        offset: 26,
                        segment: expect.objectContaining({ depth: 0 }),
                        highlights: [],
                        event: expect.any(MouseEvent),
                    },
                ]);
            });

            it('does not emit click for the click that ends a drag selection', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const el = segmentElement(adapter.root, 6);
                const dragEnd = new MouseEvent('click', { bubbles: true });
                const control = new MouseEvent('click', { bubbles: true });
                setSelection(createRangeFromOffsets(adapter.root, 8, 18)!);

                el.dispatchEvent(dragEnd);

                // Live positive control: the same click with the selection collapsed.
                window.getSelection()!.removeAllRanges();
                el.dispatchEvent(control);
                const clicks = detailsOf(adapter, 'click');
                expect(clicks).toHaveLength(1);
                expect(clicks[0].event).toBe(control);
            });

            it('emits select but not click when a real drag ends inside a highlight', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const from = charPosition(adapter.root, 7);
                const to = charPosition(adapter.root, 12);

                await userEvent.dragAndDrop(
                    page.elementLocator(from.el),
                    page.elementLocator(to.el),
                    {
                        sourcePosition: from.position,
                        targetPosition: to.position,
                    },
                );

                // The click of the drag's mouseup is dispatched before the
                // selection is confirmed, so it is recorded by the time select is.
                await expect
                    .poll(() => detailsOf(adapter, 'select'))
                    .toHaveLength(1);
                expect(window.getSelection()!.isCollapsed).toBe(false);
                expect(detailsOf(adapter, 'click')).toEqual([]);
            });

            it('emits dblclick with the browser word selection in place', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const { el, position } = charPosition(adapter.root, 10);

                await userEvent.dblClick(el, { position });

                const dblclicks = detailsOf(adapter, 'dblclick');
                expect(dblclicks).toEqual([
                    {
                        offset: 10,
                        segment: expect.objectContaining({ start: 6, end: 15 }),
                        highlights: [a, b],
                        event: expect.any(MouseEvent),
                    },
                ]);
                expect(dblclicks[0].event.type).toBe('dblclick');
                expect(window.getSelection()!.toString()).toBe('wonderful');
            });

            it.each([
                { key: 'Enter', input: '{Enter}' },
                { key: ' ', input: ' ' },
            ])(
                'emits click with segment.start for key "$key" on a focused highlighted segment',
                async ({ key, input }) => {
                    const adapter = await givenAdapter(partialOverlap);
                    const el = segmentElement(adapter.root, 6);
                    expect(el.getAttribute('tabindex')).toBe('0');
                    el.focus();

                    await userEvent.keyboard(input);

                    const clicks = detailsOf(adapter, 'click');
                    expect(clicks).toEqual([
                        {
                            offset: 6,
                            segment: expect.objectContaining({
                                start: 6,
                                end: 15,
                            }),
                            highlights: [a, b],
                            event: expect.any(KeyboardEvent),
                        },
                    ]);
                    expect((clicks[0].event as KeyboardEvent).key).toBe(key);
                },
            );

            it('prevents the default action of Space on a focused segment', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const space = new KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true,
                    cancelable: true,
                });

                segmentElement(adapter.root, 6).dispatchEvent(space);

                expect(space.defaultPrevented).toBe(true);
            });

            it('ignores keys other than Enter and Space on a focused segment', async () => {
                const adapter = await givenAdapter(partialOverlap);
                const el = segmentElement(adapter.root, 6);

                el.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
                );

                // Live positive control: Enter on the same segment.
                el.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    }),
                );
                expect(
                    detailsOf(adapter, 'click').map(
                        (d) => (d.event as KeyboardEvent).key,
                    ),
                ).toEqual(['Enter']);
            });

            it('ignores Enter on a plain segment', async () => {
                const adapter = await givenAdapter(partialOverlap);

                segmentElement(adapter.root, 21).dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    }),
                );

                // Live positive control: Enter on a highlighted segment.
                segmentElement(adapter.root, 6).dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    }),
                );
                expect(
                    detailsOf(adapter, 'click').map((d) => d.offset),
                ).toEqual([6]);
            });
        });

        describe('hover', () => {
            it('emits enter and leave as the mouse crosses highlighted segments', async () => {
                await givenPointerOutsideRoots();
                const adapter = await givenAdapter(partialOverlap);

                await userEvent.hover(segmentElement(adapter.root, 6));
                await userEvent.hover(segmentElement(adapter.root, 15));
                await userEvent.hover(segmentElement(adapter.root, 21));

                expect(
                    detailsOf(adapter, 'hover').map(
                        (d) => `${d.type}:${d.segment.start}`,
                    ),
                ).toEqual(['enter:6', 'leave:6', 'enter:15', 'leave:15']);
            });

            it('emits leave when the mouse moves out of the root', async () => {
                const outside = await givenPointerOutsideRoots();
                const adapter = await givenAdapter(partialOverlap);
                await userEvent.hover(segmentElement(adapter.root, 6));

                await userEvent.hover(outside);

                expect(
                    detailsOf(adapter, 'hover').map(
                        (d) => `${d.type}:${d.segment.start}`,
                    ),
                ).toEqual(['enter:6', 'leave:6']);
            });

            it('reports on leave the segment object it reported on enter', async () => {
                const outside = await givenPointerOutsideRoots();
                const adapter = await givenAdapter(partialOverlap);
                await userEvent.hover(segmentElement(adapter.root, 6));

                await userEvent.hover(outside);

                const hovers = detailsOf(adapter, 'hover');
                expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
                expect(hovers[1].segment).toBe(hovers[0].segment);
                expect(hovers[1].highlights).toEqual([a, b]);
            });

            // Adapters must detach core's listeners while the component can
            // still emit, so this leave reaches the caller.
            it('emits leave for the hovered segment when unmounted, with no pointer event', async () => {
                await givenPointerOutsideRoots();
                const adapter = await givenAdapter(partialOverlap);
                await userEvent.hover(segmentElement(adapter.root, 6));

                await adapter.unmount();

                const hovers = detailsOf(adapter, 'hover');
                expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
                expect(hovers[1].segment).toBe(hovers[0].segment);
                expect(hovers[1].event).toBeNull();
            });

            it('reports the entered segment, its highlights and the pointer event', async () => {
                await givenPointerOutsideRoots();
                const adapter = await givenAdapter(partialOverlap);

                await userEvent.hover(segmentElement(adapter.root, 6));

                expect(detailsOf(adapter, 'hover')).toEqual([
                    {
                        type: 'enter',
                        segment: expect.objectContaining({
                            start: 6,
                            end: 15,
                            depth: 2,
                        }),
                        highlights: [a, b],
                        event: expect.any(PointerEvent),
                    },
                ]);
            });
        });
    });

    describe(`${name} — updates`, () => {
        it('renders replaced highlights', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({ highlights: [c] });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...partialOverlap, highlights: [c] }),
            );
        });

        it('renders a switched strategy', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({ strategy: 'depth' });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...partialOverlap, strategy: 'depth' }),
            );
        });

        it('keeps the selection across an update', async () => {
            const adapter = await givenAdapter(partialOverlap);
            setSelection(createRangeFromOffsets(adapter.root, 8, 18)!);

            await adapter.update({ highlights: [a, b, c] });

            expect(getSelectionOffsets(adapter.root)).toEqual({
                start: 8,
                end: 18,
            });
            expect(window.getSelection()!.toString()).toBe(TEXT.slice(8, 18));
        });

        it('returns focus to the same segment after an update', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();
            expect(document.activeElement).toBe(
                segmentElement(adapter.root, 6),
            );

            await adapter.update({ highlights: [a, b, c] });

            expect(document.activeElement).toBe(
                segmentElement(adapter.root, 6),
            );
        });

        it('applies a changed minSelectionLength to the next selection', async () => {
            const adapter = await givenAdapter({
                ...partialOverlap,
                minSelectionLength: 5,
            });
            await selectAndWait(adapter.root, 2, 4);
            settle(release);
            expect(eventsOf(adapter, 'select')).toEqual([]);

            await adapter.update({ minSelectionLength: 1 });
            await selectAndWait(adapter.root, 2, 4);
            release();

            await expect
                .poll(() => eventsOf(adapter, 'select'))
                .toEqual([selectEvent(2, 4, [a])]);
        });

        it('applies a changed touchSelectionDelay to the next touch selection', async () => {
            const adapter = await givenAdapter({
                ...partialOverlap,
                touchSelectionDelay: 5000,
            });
            await adapter.update({ touchSelectionDelay: 40 });
            givenFakeTimeouts();
            pointer('pointerdown', adapter.root, { pointerType: 'touch' });

            await selectAndWait(adapter.root, 8, 18);

            vi.advanceTimersByTime(39);
            expect(eventsOf(adapter, 'select')).toEqual([]);
            vi.advanceTimersByTime(1);
            expect(eventsOf(adapter, 'select')).toEqual([
                selectEvent(8, 18, [a, b]),
            ]);
        });
    });

    describe(`${name} — teardown`, () => {
        // Each gesture targets a segment element rendered before unmount: an
        // adapter that left its listeners on the old root would report it.
        //
        // Blind spots no adapter-level test can see:
        // - document-level listeners (selectionchange, pointerdown/up, keyup)
        //   left behind after the root is detached: with the root gone, no
        //   selection can land in it, so a leaked listener has nothing to emit.
        //   Core's attachInteractions detach tests cover these on a root that
        //   stays in the document.
        // - a framework that silences a component's emits once it is unmounted:
        //   a leaked listener would fire but its event would never be recorded,
        //   so these tests pass whether or not the adapter detached.
        it.each([
            {
                gesture: 'click',
                type: 'click' as const,
                act: (el: HTMLElement) => el.click(),
            },
            {
                gesture: 'Enter key',
                type: 'click' as const,
                act: (el: HTMLElement) =>
                    el.dispatchEvent(
                        new KeyboardEvent('keydown', {
                            key: 'Enter',
                            bubbles: true,
                        }),
                    ),
            },
            {
                gesture: 'mouse hover',
                type: 'hover' as const,
                act: (el: HTMLElement) => pointer('pointerover', el),
            },
        ])(
            'records no $gesture on a segment rendered before unmount',
            async ({ type, act }) => {
                const unmounted = await givenAdapter(partialOverlap);
                const live = await givenAdapter(partialOverlap);
                const stale = segmentElement(unmounted.root, 6);
                await unmounted.unmount();

                act(stale);

                // Live positive control: the same gesture on a mounted instance.
                act(segmentElement(live.root, 6));
                expect(eventsOf(unmounted, type)).toEqual([]);
                expect(eventsOf(live, type)).toHaveLength(1);
            },
        );
    });
}
