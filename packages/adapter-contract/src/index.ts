/**
 * The adapter contract suite (spec §4.6, §6, §9): every adapter registers it
 * with a factory and must pass it unchanged. Differences between adapters live
 * only in the factory, never in `if (name === …)` inside the suite.
 *
 * This package imports `@overlapmark/core` without declaring it: core's own
 * tests run this suite, so a declared dependency would be a workspace cycle.
 * Every consumer resolves `@overlapmark/core` (and `/adapter`, `/dom`) to core's sources
 * through the shared `vitest.workspace-aliases.ts` and
 * `tsconfig.workspace-paths.json` at the repository root, so the suite and the
 * adapter share one module instance.
 */
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    Segment,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import { DEFAULT_COLOR } from '@overlapmark/core';
import {
    createRangeFromOffsets,
    getSelectionOffsets,
    getTextLength,
} from '@overlapmark/core/dom';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
    REPLACED_TEXT,
    TEXT,
    a,
    b,
    c,
    codePointRanges,
    fixtures,
    adjacent,
    partialOverlap,
} from './fixtures';
import {
    charPosition,
    clearSelectionAndWait,
    givenPointerOutsideRoots,
    keyUp,
    mutationsHandled,
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
    RecordEvent,
} from './types';

export type {
    AdapterEvent,
    AdapterFactory,
    ContractProps,
    MountedAdapter,
    RecordEvent,
};
export { expectedTree } from './reference-tree';
export { serializeRoot } from './serialize';
export type { ElementTree, RootTree, TreeNode } from './serialize';
export * from './fixtures';
export { propsOf } from './props';
export * from './gestures';

type DetailOf<K extends AdapterEvent['type']> = K extends 'select'
    ? SelectDetail
    : K extends 'hover'
      ? HoverDetail
      : PointDetail;

/** Anything holding recorded adapter events, in order. */
export interface EventSource {
    readonly events: readonly AdapterEvent[];
}

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

/** A mounted adapter together with the record the suite keeps of its events. */
interface ContractAdapter extends MountedAdapter, EventSource {
    /** The element the suite mounted the adapter in. */
    readonly host: HTMLElement;
    /**
     * Calls `inspect` with each event recorded from now on, at the moment it
     * is recorded, so a test can read the page as a subscriber of that event
     * would.
     */
    whenRecorded(inspect: (event: AdapterEvent) => void): void;
}

/** A `defaultColor` unlike core's own. */
const CUSTOM_COLOR = 'rgb(255, 0, 170)';

/** Brushes unlike core's SVG stroke, so a dropped `brush` shows. */
const solidBrush = (color: string): string =>
    `linear-gradient(${color}, ${color})`;
const stripedBrush = (color: string): string =>
    `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px)`;

/** The `--om-brush` of every highlight element under `root`, in document order. */
function brushesOf(root: HTMLElement): string[] {
    return [...root.querySelectorAll<HTMLElement>('.om-hl')].map((el) =>
        el.style.getPropertyValue('--om-brush'),
    );
}

const strategies: { strategy: Strategy }[] = [
    { strategy: 'layers' },
    { strategy: 'depth' },
];

export function defineAdapterContract(factory: AdapterFactory): void {
    const { name } = factory;

    /**
     * Mounts `props` in a fresh host at the end of the body and records every
     * event the factory passes to `record`. Unmounting, host removal and
     * clearing the selection are registered here, so tests never clean up by
     * hand.
     */
    async function givenAdapter(
        props: ContractProps,
    ): Promise<ContractAdapter> {
        const host = document.createElement('div');
        document.body.append(host);
        const events: AdapterEvent[] = [];
        const inspectors: ((event: AdapterEvent) => void)[] = [];
        const record: RecordEvent = (event) => {
            events.push(event);
            for (const inspect of inspectors) inspect(event);
        };
        const mounted = await factory.mount(host, props, record);
        let live = true;
        onTestFinished(async () => {
            if (live) await mounted.unmount();
            host.remove();
            await clearSelectionAndWait();
        });
        return {
            host,
            get root() {
                return mounted.root;
            },
            events,
            whenRecorded: (inspect) => {
                inspectors.push(inspect);
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

            const highlighted = [...root.querySelectorAll('[data-om-depth]')];

            expect(highlighted).toHaveLength(3);
            for (const el of highlighted)
                expect(el.getAttribute('tabindex')).toBe('0');
        });

        it('matches a segment with [data-om-ids~=id] for each covering highlight', async () => {
            const { root } = await givenAdapter(partialOverlap);

            const coveredByA = root.querySelectorAll('[data-om-ids~="a"]');
            const coveredByB = root.querySelectorAll('[data-om-ids~="b"]');
            const coveredByBoth = root.querySelectorAll(
                '[data-om-ids~="a"][data-om-ids~="b"]',
            );

            expect(coveredByA).toHaveLength(2);
            expect(coveredByB).toHaveLength(2);
            expect(coveredByBoth).toHaveLength(1);
        });

        it('marks the root with the multiply overlap mode by default', async () => {
            const { root } = await givenAdapter(partialOverlap);

            expect(root.getAttribute('data-om-overlap')).toBe('multiply');
        });

        it('marks the root with the overlap mode it was given', async () => {
            const { root } = await givenAdapter({
                ...partialOverlap,
                overlap: 'darken',
            });

            expect(root.getAttribute('data-om-overlap')).toBe('darken');
            expect(serializeRoot(root)).toEqual(
                expectedTree({ ...partialOverlap, overlap: 'darken' }),
            );
        });

        it('sets --om-default-color on the root only when defaultColor is given', async () => {
            const given = await givenAdapter({
                ...partialOverlap,
                defaultColor: CUSTOM_COLOR,
            });

            const absent = await givenAdapter(partialOverlap);

            expect(
                given.root.style.getPropertyValue('--om-default-color'),
            ).toBe(CUSTOM_COLOR);
            expect(absent.root.hasAttribute('style')).toBe(false);
        });

        it('renders no tabindex when focusable is false', async () => {
            const { root } = await givenAdapter({
                ...partialOverlap,
                focusable: false,
            });

            expect(root.querySelectorAll('[data-om-depth]')).toHaveLength(3);
            expect(root.querySelectorAll('[tabindex]')).toHaveLength(0);
        });

        describe.each(strategies)(
            'with the $strategy strategy',
            ({ strategy }) => {
                // `adjacent`: `right` has a color, `left` has none.
                it('paints a highlight without color with the given brush and defaultColor', async () => {
                    const props = {
                        ...adjacent,
                        strategy,
                        defaultColor: CUSTOM_COLOR,
                        brush: solidBrush,
                    };

                    const { root } = await givenAdapter(props);

                    expect(serializeRoot(root)).toEqual(expectedTree(props));
                    expect(brushesOf(root)).toContain(solidBrush(CUSTOM_COLOR));
                });
            },
        );
    });

    describe(`${name} — accessibility`, () => {
        /** Names the covering highlights instead of counting them. */
        const namesOf = (highlights: readonly Highlight[]): string =>
            highlights.map((h) => h.id).join(' and ');

        it('gives a focusable segment the button role and a description of how many highlights cover it', async () => {
            const { root } = await givenAdapter(partialOverlap);

            const coveredOnce = segmentElement(root, 0);
            const coveredTwice = segmentElement(root, 6);

            await expect.element(coveredTwice).toHaveRole('button');
            await expect
                .element(coveredTwice)
                .toHaveAccessibleName(TEXT.slice(6, 15));
            await expect
                .element(coveredTwice)
                .toHaveAccessibleDescription('2 highlights');
            await expect
                .element(coveredOnce)
                .toHaveAccessibleDescription('1 highlight');
        });

        it('uses describe to word the description', async () => {
            const { root } = await givenAdapter({
                ...partialOverlap,
                describe: namesOf,
            });

            const coveredTwice = segmentElement(root, 6);

            await expect
                .element(coveredTwice)
                .toHaveAccessibleDescription('a and b');
        });

        it('gives no role to an unfocusable segment', async () => {
            const focusable = await givenAdapter(partialOverlap);
            const unfocusable = await givenAdapter({
                ...partialOverlap,
                focusable: false,
            });

            // Live control: the same segment, focusable.
            await expect
                .element(segmentElement(focusable.root, 6))
                .toHaveRole('button');
            await expect
                .element(segmentElement(focusable.root, 6))
                .toHaveAccessibleDescription();
            expect(unfocusable.root.querySelectorAll('[role]')).toHaveLength(0);
            await expect
                .element(segmentElement(unfocusable.root, 6))
                .not.toHaveAccessibleDescription();
        });

        it('keeps the description out of the select text and offsets', async () => {
            const decoration = (segment: Segment): string =>
                `[${segment.highlights.length}]`;
            const adapter = await givenAdapter({
                ...partialOverlap,
                decoration,
            });
            const coveredTwice = segmentElement(adapter.root, 6);
            await expect
                .element(coveredTwice)
                .toHaveAccessibleDescription('2 highlights');
            await expect
                .element(coveredTwice)
                .toHaveAccessibleName(TEXT.slice(6, 15));
            await selectAndWait(adapter.root, 3, 20);

            release();

            await expect
                .poll(() => eventsOf(adapter, 'select'))
                .toEqual([selectEvent(3, 20, [a, b])]);
            expect(getTextLength(adapter.root)).toBe(TEXT.length);
            expect(getSelectionOffsets(adapter.root)).toEqual({
                start: 3,
                end: 20,
            });
        });

        it('rewords the description when describe is replaced', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({ describe: namesOf });

            await expect
                .element(segmentElement(adapter.root, 6))
                .toHaveAccessibleDescription('a and b');
            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...partialOverlap, describe: namesOf }),
            );
        });

        it('recounts the description when the covering highlights change', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({ highlights: [a, b, c] });

            // `c` starts at 10: [10,15) is now covered by a, b and c.
            await expect
                .element(segmentElement(adapter.root, 10))
                .toHaveAccessibleDescription('3 highlights');
        });
    });

    describe(`${name} — color validation`, () => {
        const unsafe = 'red; position: fixed';

        it('renders an unsafe color as the default color without the injected text in the markup', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            onTestFinished(() => warn.mockRestore());
            const safe = await givenAdapter({
                ...partialOverlap,
                highlights: [{ ...a, color: '#123456' }, b],
            });
            const injected = await givenAdapter({
                ...partialOverlap,
                highlights: [{ ...a, color: unsafe }, b],
            });

            expect(safe.root.outerHTML).toContain('#123456');
            expect(injected.root.outerHTML).not.toContain('position');
            expect(injected.root.outerHTML).not.toContain('fixed');
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

    describe(`${name} — decorations (style tier 3)`, () => {
        /** Text that would shift every later offset if it were counted. */
        const decoration = (segment: Segment): string =>
            `[${segment.highlights.map((h) => h.id).join('+')}]`;
        const decorated = { ...partialOverlap, decoration };

        /** Mounts `props` and checks the precondition: one decoration per highlighted segment. */
        async function givenDecoratedAdapter(
            props: ContractProps,
        ): Promise<ContractAdapter> {
            const adapter = await givenAdapter(props);
            expect(
                [...adapter.root.querySelectorAll('[data-om-skip]')].map(
                    (el) => el.textContent,
                ),
            ).toEqual(['[a]', '[a+b]', '[b]']);
            return adapter;
        }

        describe.each(strategies)(
            'with the $strategy strategy',
            ({ strategy }) => {
                const props = { ...decorated, strategy };

                it('renders each decoration after the text of the innermost element of its highlighted segment', async () => {
                    const { root } = await givenAdapter(props);

                    expect(serializeRoot(root)).toEqual(expectedTree(props));
                });

                it('gives getTextLength the source text length', async () => {
                    const { root } = await givenDecoratedAdapter(props);

                    expect(getTextLength(root)).toBe(TEXT.length);
                });

                // Offsets only: a DOM range across a decoration contains its
                // text, and whether Selection#toString shows it depends on the
                // optional stylesheet (user-select: none).
                it('maps the selected range back to the same offsets for every start/end pair', async () => {
                    const { root } = await givenDecoratedAdapter(props);
                    const ranges = codePointRanges(TEXT);

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

        it('emits select text from the source text, without decoration text', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            await selectAndWait(adapter.root, 3, 20);

            release();

            await expect
                .poll(() => eventsOf(adapter, 'select'))
                .toEqual([selectEvent(3, 20, [a, b])]);
        });

        // Character 16 follows the "[a+b]" decoration at the end of [6,15).
        it('reports the offset of the clicked character, not counting decoration text', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            const { el, position } = charPosition(adapter.root, 16);

            await userEvent.click(el, { position });

            expect(detailsOf(adapter, 'click').map((d) => d.offset)).toEqual([
                16,
            ]);
        });

        // The point lies on no source character, so the offset falls back to
        // the start of the segment the decoration belongs to.
        it('reports a click on a decoration as a click on its segment, at the segment start', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            const decorationEl = adapter.root.querySelector<HTMLElement>(
                '[data-om-start="6"] [data-om-skip]',
            )!;

            await userEvent.click(decorationEl);

            const clicks = detailsOf(adapter, 'click');
            expect(clicks).toEqual([
                {
                    offset: 6,
                    segment: expect.objectContaining({ start: 6, end: 15 }),
                    highlights: [a, b],
                    event: expect.any(MouseEvent),
                },
            ]);
        });

        it('hides every decoration from assistive technology', async () => {
            const { root } = await givenDecoratedAdapter(decorated);

            for (const el of root.querySelectorAll('[data-om-skip]'))
                expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
        });

        it('renders the decorations of a decoration function given in place of the first', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            const depthOf = (segment: Segment): string => `×${segment.depth}`;

            await adapter.update({ decoration: depthOf });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...decorated, decoration: depthOf }),
            );
            expect(
                [...adapter.root.querySelectorAll('[data-om-skip]')].map(
                    (el) => el.textContent,
                ),
            ).toEqual(['×1', '×2', '×1']);
        });

        it('keeps the selection across an update of the decorated tree', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            setSelection(createRangeFromOffsets(adapter.root, 3, 20)!);

            await adapter.update({ highlights: [a, b, c] });

            expect(getSelectionOffsets(adapter.root)).toEqual({
                start: 3,
                end: 20,
            });
        });

        it('returns focus to the same segment after an update of the decorated tree', async () => {
            const adapter = await givenDecoratedAdapter(decorated);
            segmentElement(adapter.root, 6).focus();
            expect(document.activeElement).toBe(
                segmentElement(adapter.root, 6),
            );

            await adapter.update({ highlights: [a, b, c] });

            expect(document.activeElement).toBe(
                segmentElement(adapter.root, 6),
            );
        });
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

            it('ignores a 0-length selection and reports a 1-character one by default', async () => {
                const adapter = await givenAdapter(partialOverlap);
                await selectAndWait(adapter.root, 4, 4);

                settle(release);

                // Live positive control: one character, released the same way.
                await selectAndWait(adapter.root, 4, 5);
                settle(release);
                expect(eventsOf(adapter, 'select')).toEqual([
                    selectEvent(4, 5, [a]),
                ]);
            });

            it('confirms a touch selection after 500 ms by default', async () => {
                const adapter = await givenAdapter(partialOverlap);
                givenFakeTimeouts();
                pointer('pointerdown', adapter.root, { pointerType: 'touch' });

                await selectAndWait(adapter.root, 8, 18);

                vi.advanceTimersByTime(499);
                expect(eventsOf(adapter, 'select')).toEqual([]);
                vi.advanceTimersByTime(1);
                expect(eventsOf(adapter, 'select')).toEqual([
                    selectEvent(8, 18, [a, b]),
                ]);
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

        it('renders a changed defaultColor and brush', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({
                defaultColor: CUSTOM_COLOR,
                brush: solidBrush,
            });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({
                    ...partialOverlap,
                    defaultColor: CUSTOM_COLOR,
                    brush: solidBrush,
                }),
            );
            // Four marks: a · a+b (two layers) · b.
            expect(brushesOf(adapter.root)).toEqual(
                Array(4).fill(solidBrush(CUSTOM_COLOR)),
            );
        });

        it('switches the overlap mode in place and keeps the selection', async () => {
            const adapter = await givenAdapter(partialOverlap);
            const root = adapter.root;
            setSelection(createRangeFromOffsets(root, 8, 18)!);

            await adapter.update({ overlap: 'none' });

            expect(adapter.root).toBe(root);
            expect(root.getAttribute('data-om-overlap')).toBe('none');
            expect(serializeRoot(root)).toEqual(
                expectedTree({ ...partialOverlap, overlap: 'none' }),
            );
            expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        });

        it('applies a new defaultColor in place', async () => {
            const adapter = await givenAdapter({
                ...partialOverlap,
                defaultColor: CUSTOM_COLOR,
            });
            const root = adapter.root;

            await adapter.update({ defaultColor: '#123456' });

            expect(adapter.root).toBe(root);
            expect(root.style.getPropertyValue('--om-default-color')).toBe(
                '#123456',
            );
            expect(serializeRoot(root)).toEqual(
                expectedTree({ ...partialOverlap, defaultColor: '#123456' }),
            );
        });

        it('takes --om-default-color off the root when defaultColor is removed', async () => {
            const adapter = await givenAdapter({
                ...partialOverlap,
                defaultColor: CUSTOM_COLOR,
            });

            const before =
                adapter.root.style.getPropertyValue('--om-default-color');

            await adapter.update({ defaultColor: undefined });

            expect(before).toBe(CUSTOM_COLOR);
            expect(
                adapter.root.style.getPropertyValue('--om-default-color'),
            ).toBe('');
            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree(partialOverlap),
            );
        });

        it('renders a brush given in place of the first', async () => {
            const adapter = await givenAdapter({
                ...partialOverlap,
                brush: solidBrush,
            });

            await adapter.update({ brush: stripedBrush });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...partialOverlap, brush: stripedBrush }),
            );
            expect(brushesOf(adapter.root)).toEqual(
                Array(4).fill(stripedBrush(DEFAULT_COLOR)),
            );
        });

        it('renders a replaced text', async () => {
            const adapter = await givenAdapter(partialOverlap);

            await adapter.update({ text: REPLACED_TEXT });

            expect(serializeRoot(adapter.root)).toEqual(
                expectedTree({ ...partialOverlap, text: REPLACED_TEXT }),
            );
        });

        it('reports the updated highlights on a click after update', async () => {
            const adapter = await givenAdapter(partialOverlap);
            await adapter.update({ highlights: [c] });
            const { el, position } = charPosition(adapter.root, 12);

            await userEvent.click(el, { position });

            const clicks = detailsOf(adapter, 'click');
            expect(clicks).toEqual([
                {
                    offset: 12,
                    segment: expect.objectContaining({ start: 10, end: 24 }),
                    highlights: [c],
                    event: expect.any(MouseEvent),
                },
            ]);
            expect(clicks[0].highlights[0]).toBe(c);
        });

        it('emits select text from the updated text', async () => {
            const adapter = await givenAdapter(partialOverlap);
            await adapter.update({ text: REPLACED_TEXT });
            await selectAndWait(adapter.root, 8, 17);

            release();

            await expect
                .poll(() => eventsOf(adapter, 'select'))
                .toEqual([
                    {
                        type: 'select',
                        detail: {
                            start: 8,
                            end: 17,
                            text: 'wonderful',
                            rect: expect.any(DOMRect),
                            highlights: [a, b],
                        },
                    },
                ]);
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

    // Every adapter restores through core's captureViewState/restoreViewState,
    // which own these rules; the cases pin them on each adapter's update flush.
    describe(`${name} — selection across an update`, () => {
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

        it('keeps the selection when an update passes an equal text built anew', async () => {
            const adapter = await givenAdapter(partialOverlap);
            setSelection(createRangeFromOffsets(adapter.root, 8, 18)!);

            await adapter.update({
                text: [...TEXT].join(''),
                highlights: [a, b, c],
            });

            expect(getSelectionOffsets(adapter.root)).toEqual({
                start: 8,
                end: 18,
            });
        });

        // U1: the same offsets over a new text select different characters,
        // which the user did not select.
        it('clears the selection when an update replaces the text', async () => {
            const adapter = await givenAdapter(partialOverlap);
            setSelection(createRangeFromOffsets(adapter.root, 8, 18)!);

            await adapter.update({ text: REPLACED_TEXT });

            expect(getSelectionOffsets(adapter.root)).toBeNull();
            expect(window.getSelection()!.toString()).toBe('');
        });

        it('leaves a selection outside the root alone when an update replaces the text', async () => {
            const adapter = await givenAdapter(partialOverlap);
            const outside = givenTextOutsideRoots('Elsewhere on the page');
            const range = document.createRange();
            range.setStart(outside, 0);
            range.setEnd(outside, 9);
            setSelection(range);

            await adapter.update({ text: REPLACED_TEXT });

            expect(window.getSelection()!.toString()).toBe('Elsewhere');
        });
    });

    describe(`${name} — focus across an update`, () => {
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

        // U2: the focused segment [6,15) is gone; [0,15) of `a` now covers 6.
        it('moves focus to the highlighted segment that now covers the focused offset', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();

            await adapter.update({ highlights: [a] });

            expect(document.activeElement).toBe(
                segmentElement(adapter.root, 0),
            );
        });

        // U2: with `c` alone, offset 6 lies in the plain segment [0,10).
        it('focuses nothing in the root when the focused offset is no longer highlighted', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();

            await adapter.update({ highlights: [c] });

            expect(
                segmentElement(adapter.root, 0).hasAttribute('data-om-depth'),
            ).toBe(false);
            expect(adapter.root.contains(document.activeElement)).toBe(false);
        });

        // U2 applies to an unchanged text only: in a new text the covering
        // segment holds other characters.
        it('does not move focus to another segment when an update replaces the text', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();

            await adapter.update({ text: REPLACED_TEXT, highlights: [a] });

            expect(
                segmentElement(adapter.root, 0).hasAttribute('tabindex'),
            ).toBe(true);
            expect(adapter.root.contains(document.activeElement)).toBe(false);
        });

        // The segment keeps its segmentKey, so a framework may patch the
        // focused element in place.
        it('takes focus off the focused segment when an update makes it unfocusable', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();

            await adapter.update({ focusable: false });

            expect(
                segmentElement(adapter.root, 6).hasAttribute('data-om-depth'),
            ).toBe(true);
            expect(adapter.root.contains(document.activeElement)).toBe(false);
        });

        // Core lifts a pressed segment's tabindex until the mouse button is
        // released; what the update renders in the meantime wins.
        it('leaves a segment unfocusable when an update during a mouse press makes it unfocusable', async () => {
            const adapter = await givenAdapter(partialOverlap);
            pointer('pointerdown', segmentElement(adapter.root, 6));
            await adapter.update({ focusable: false });

            settle(release);

            expect(adapter.root.querySelectorAll('[tabindex]')).toHaveLength(0);
        });

        it('keeps a segment focusable when an update during a mouse press leaves it focusable', async () => {
            const adapter = await givenAdapter(partialOverlap);
            pointer('pointerdown', segmentElement(adapter.root, 6));
            await adapter.update({ highlights: [a, b, c] });

            settle(release);

            expect(
                segmentElement(adapter.root, 6).getAttribute('tabindex'),
            ).toBe('0');
        });

        it('focuses nothing in the root when the segment covering the focused offset is not focusable', async () => {
            const adapter = await givenAdapter(partialOverlap);
            segmentElement(adapter.root, 6).focus();

            await adapter.update({ highlights: [a], focusable: false });

            expect(
                segmentElement(adapter.root, 0).hasAttribute('data-om-depth'),
            ).toBe(true);
            expect(adapter.root.contains(document.activeElement)).toBe(false);
        });
    });

    describe(`${name} — hover across an update`, () => {
        /** The trail of recorded hover events, as `type:segmentStart`. */
        const hoverTrail = (adapter: ContractAdapter): string[] =>
            detailsOf(adapter, 'hover').map(
                (d) => `${d.type}:${d.segment.start}`,
            );

        /** Hovers character 7, inside the [6,15) a+b segment of `partialOverlap`. */
        async function givenHoveredOverlap(): Promise<{
            adapter: ContractAdapter;
            outside: HTMLElement;
        }> {
            const outside = await givenPointerOutsideRoots();
            const adapter = await givenAdapter(partialOverlap);
            const { el, position } = charPosition(adapter.root, 7);
            await userEvent.hover(el, { position });
            expect(hoverTrail(adapter)).toEqual(['enter:6']);
            return { adapter, outside };
        }

        /** Highlights 0–5 only: character 7 becomes plain text, and segment 0 stays focusable. */
        const left = { id: 'left', start: 0, end: 5 };

        it('emits leave, with no pointer event, when an update removes the hovered highlight', async () => {
            const { adapter } = await givenHoveredOverlap();

            await adapter.update({ highlights: [left] });

            await expect.poll(() => hoverTrail(adapter)).toHaveLength(2);
            const hovers = detailsOf(adapter, 'hover');
            expect(hovers[1]).toEqual({
                type: 'leave',
                segment: hovers[0].segment,
                highlights: [a, b],
                event: null,
            });
            expect(hovers[1].segment).toBe(hovers[0].segment);
        });

        it('emits that leave only once', async () => {
            const { adapter } = await givenHoveredOverlap();
            await adapter.update({ highlights: [left] });
            await expect.poll(() => hoverTrail(adapter)).toHaveLength(2);

            await userEvent.hover(segmentElement(adapter.root, 0));

            // Live positive control: the move onto segment 0 is recorded.
            expect(hoverTrail(adapter)).toEqual([
                'enter:6',
                'leave:6',
                'enter:0',
            ]);
        });

        // The pointer moves out before the second update: after a re-render,
        // Chromium sends boundary events of its own to a pointer that stays put.
        it('emits enter when the mouse moves back onto a highlight an update brought back', async () => {
            const { adapter, outside } = await givenHoveredOverlap();
            await adapter.update({ highlights: [left] });
            await expect.poll(() => hoverTrail(adapter)).toHaveLength(2);
            await userEvent.hover(outside);
            await adapter.update({ highlights: [a, b] });

            const back = charPosition(adapter.root, 7);
            await userEvent.hover(back.el, { position: back.position });

            expect(hoverTrail(adapter)).toEqual([
                'enter:6',
                'leave:6',
                'enter:6',
            ]);
        });

        it('emits leave, with no pointer event, when an update changes the highlight ids covering the hovered segment', async () => {
            const { adapter } = await givenHoveredOverlap();
            // Same range as `b`, so the hovered segment still starts at 6.
            const b2 = { id: 'b2', start: 6, end: 21 };
            const handled = mutationsHandled(adapter.root);

            await adapter.update({ highlights: [a, b2] });
            await handled;

            const hovers = detailsOf(adapter, 'hover');
            const leaves = hovers.filter((d) => d.type === 'leave');
            expect(leaves).toEqual([
                {
                    type: 'leave',
                    segment: hovers[0].segment,
                    highlights: [a, b],
                    event: null,
                },
            ]);
            expect(leaves[0].segment).toBe(hovers[0].segment);
        });

        it('emits nothing when an update re-renders the hovered segment unchanged', async () => {
            const { adapter, outside } = await givenHoveredOverlap();
            const handled = mutationsHandled(adapter.root);

            await adapter.update({
                highlights: [a, b, { id: 'd', start: 24, end: 30 }],
            });
            await handled;

            expect(hoverTrail(adapter)).toEqual(['enter:6']);
            // Live positive control: moving out still leaves the segment entered first.
            await userEvent.hover(outside);
            const hovers = detailsOf(adapter, 'hover');
            expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
            expect(hovers[1].segment).toBe(hovers[0].segment);
        });

        it('emits that leave after the update restored the selection and focus', async () => {
            const { adapter } = await givenHoveredOverlap();
            segmentElement(adapter.root, 0).focus();
            await selectAndWait(adapter.root, 16, 19);
            const seen: {
                event: AdapterEvent;
                offsets: unknown;
                focused: Element | null;
            }[] = [];
            adapter.whenRecorded((event) =>
                seen.push({
                    event,
                    offsets: getSelectionOffsets(adapter.root),
                    focused: document.activeElement,
                }),
            );

            await adapter.update({ highlights: [left] });

            await expect.poll(() => seen).toHaveLength(1);
            expect(seen[0].event).toEqual({
                type: 'hover',
                detail: expect.objectContaining({ type: 'leave', event: null }),
            });
            expect(seen[0].offsets).toEqual({ start: 16, end: 19 });
            expect(seen[0].focused).toBe(segmentElement(adapter.root, 0));
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

        // Taking the host out of the document is not unmounting: the
        // instance still renders updates, though no selection can be in it.
        it('applies an update made while its host is out of the document and the page has a selection', async () => {
            const removed = await givenAdapter(partialOverlap);
            const live = await givenAdapter(partialOverlap);
            removed.host.remove();
            await selectAndWait(live.root, 8, 18);

            await removed.update({ highlights: [a] });

            expect(
                removed.root.querySelectorAll('[data-om-ids~="b"]'),
            ).toHaveLength(0);
            expect(getSelectionOffsets(live.root)).toEqual({
                start: 8,
                end: 18,
            });
        });
    });
}
