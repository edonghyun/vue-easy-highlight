import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    computeSegments,
    highlightsInRange,
    segmentAt,
    type Highlight,
} from '../src/index';
import { LONE_SURROGATE, codePointBoundaries, textArb } from './helpers/text';

const inputArb = textArb.chain((text) => {
    const n = text.length;
    const hl = fc.record({
        id: fc.constantFrom('a', 'b', 'c', 'd'),
        start: fc.integer({ min: -3, max: n + 3 }),
        end: fc.integer({ min: -3, max: n + 3 }),
    });
    return fc.record({
        text: fc.constant(text),
        highlights: fc.array(hl, { maxLength: 8 }),
    });
});

interface Norm {
    h: Highlight;
    s: number;
    e: number;
    i: number;
}

/**
 * Oracle for spec §4.2, written from the spec rather than from production:
 * clamp to [0, length], drop empty or reversed ranges, then widen each end
 * outward to the nearest code-point boundary.
 */
function normalizedEntries(text: string, hs: Highlight[]): Norm[] {
    const bounds = codePointBoundaries(text);
    const clamp = (x: number) => Math.max(0, Math.min(x, text.length));
    return hs.flatMap((h, i) => {
        const start = clamp(h.start);
        const end = clamp(h.end);
        if (start >= end) return [];
        const s = Math.max(...bounds.filter((b) => b <= start));
        const e = Math.min(...bounds.filter((b) => b >= end));
        return [{ h, s, e, i }];
    });
}

function normalizedRanges(text: string, hs: Highlight[]): [number, number][] {
    return normalizedEntries(text, hs).map((x) => [x.s, x.e]);
}

const byRule = (x: Norm, y: Norm) =>
    x.s - y.s || y.e - y.s - (x.e - x.s) || x.i - y.i;

/**
 * Applies `order` (a permutation of input indices) but keeps highlights whose
 * normalized (start, length) keys tie in their original relative order, since
 * input order is the documented tie-breaker.
 */
function keepTiesInInputOrder(
    order: number[],
    text: string,
    hs: Highlight[],
): Highlight[] {
    const keys = new Map<number, string>();
    for (const x of normalizedEntries(text, hs))
        keys.set(x.i, `${x.s}:${x.e - x.s}`);
    const keyOf = (i: number) => keys.get(i) ?? `dropped:${i}`;
    const tiesInInputOrder = new Map<string, number[]>();
    hs.forEach((_, i) => {
        const group = tiesInInputOrder.get(keyOf(i)) ?? [];
        group.push(i);
        tiesInInputOrder.set(keyOf(i), group);
    });
    return order.map((i) => hs[tiesInInputOrder.get(keyOf(i))!.shift()!]);
}

describe('computeSegments properties', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('segments concatenate back to the original text', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                const s = computeSegments(text, highlights);

                expect(s.map((x) => x.text).join('')).toBe(text);
            }),
        );
    });

    it('each segment text equals text.slice(start, end)', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                for (const seg of computeSegments(text, highlights)) {
                    expect(seg.text).toBe(text.slice(seg.start, seg.end));
                }
            }),
        );
    });

    it('segments are contiguous and non-empty', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                const s = computeSegments(text, highlights);

                if (text.length === 0) {
                    expect(s).toEqual([]);
                    return;
                }
                expect(s[0].start).toBe(0);
                expect(s[s.length - 1].end).toBe(text.length);
                s.forEach((x, i) => {
                    expect(x.start).toBeLessThan(x.end);
                    if (i > 0) expect(x.start).toBe(s[i - 1].end);
                });
            }),
        );
    });

    it('depth matches brute force', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                const ranges = normalizedRanges(text, highlights);

                const s = computeSegments(text, highlights);

                for (let i = 0; i < text.length; i++) {
                    const expected = ranges.filter(
                        ([a, b]) => a <= i && i < b,
                    ).length;
                    const seg = segmentAt(s, i)!;
                    expect(seg.depth).toBe(expected);
                    expect(seg.highlights.length).toBe(expected);
                }
            }),
        );
    });

    it('segment highlights follow the ordering rule on normalized ranges', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                const norm = normalizedEntries(text, highlights);

                const s = computeSegments(text, highlights);

                for (const seg of s) {
                    const expected = norm
                        .filter((x) => x.s <= seg.start && seg.end <= x.e)
                        .sort(byRule)
                        .map((x) => x.h);
                    expect(seg.highlights.length).toBe(expected.length);
                    seg.highlights.forEach((h, k) =>
                        expect(h).toBe(expected[k]),
                    );
                }
            }),
        );
    });

    it('input order only breaks ties: other reorderings give the same segments', () => {
        const reorderedArb = inputArb.chain(({ text, highlights }) => {
            const indices = highlights.map((_, i) => i);
            return fc
                .shuffledSubarray(indices, {
                    minLength: indices.length,
                    maxLength: indices.length,
                })
                .map((order) => ({
                    text,
                    highlights,
                    reordered: keepTiesInInputOrder(order, text, highlights),
                }));
        });
        fc.assert(
            fc.property(reorderedArb, ({ text, highlights, reordered }) => {
                const expected = computeSegments(text, highlights);

                const actual = computeSegments(text, reordered);

                expect(actual).toEqual(expected);
            }),
        );
    });

    it('highlightsInRange equals brute-force union in rule order', () => {
        fc.assert(
            fc.property(
                inputArb,
                fc.integer({ min: -2, max: 40 }),
                fc.integer({ min: -2, max: 40 }),
                ({ text, highlights }, a, b) => {
                    const s = computeSegments(text, highlights);
                    const expected = normalizedEntries(text, highlights)
                        .filter((x) => x.s < b && a < x.e && a < b)
                        .sort(byRule)
                        .map((x) => x.h);

                    const actual = highlightsInRange(s, a, b);

                    expect(actual.length).toBe(expected.length);
                    actual.forEach((h, k) => expect(h).toBe(expected[k]));
                },
            ),
        );
    });

    it('highlightsInRange returns the same order for copies of the segments', () => {
        fc.assert(
            fc.property(
                inputArb,
                fc.integer({ min: -2, max: 40 }),
                fc.integer({ min: -2, max: 40 }),
                ({ text, highlights }, a, b) => {
                    const s = computeSegments(text, highlights);
                    const copies = s.map((x) => ({
                        ...x,
                        highlights: [...x.highlights],
                    }));

                    const original = highlightsInRange(s, a, b);
                    const copied = highlightsInRange(copies, a, b);

                    expect(copied.length).toBe(original.length);
                    copied.forEach((h, k) => expect(h).toBe(original[k]));
                },
            ),
        );
    });

    it('never produces lone surrogates', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                for (const seg of computeSegments(text, highlights)) {
                    expect(LONE_SURROGATE.test(seg.text)).toBe(false);
                }
            }),
        );
    });
});
