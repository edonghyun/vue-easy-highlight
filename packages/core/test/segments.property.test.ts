import fc from 'fast-check';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { computeSegments, segmentAt, type Highlight } from '../src/index';

const textArb = fc
    .array(
        fc.oneof(
            fc.string({ unit: 'grapheme', maxLength: 4 }),
            fc.constantFrom('😀', '한글', '👨‍👩‍👧', 'é', '\r\n', '🏳️‍🌈'),
        ),
        { maxLength: 12 },
    )
    .map((parts) => parts.join(''));

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

const LONE =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function normalizedRanges(text: string, hs: Highlight[]): [number, number][] {
    const n = text.length;
    const out: [number, number][] = [];
    for (const h of hs) {
        let s = Math.max(0, Math.min(h.start, n));
        let e = Math.max(0, Math.min(h.end, n));
        if (s >= e) continue;
        const code = (i: number) => text.charCodeAt(i);
        if (
            s > 0 &&
            code(s) >= 0xdc00 &&
            code(s) <= 0xdfff &&
            code(s - 1) >= 0xd800 &&
            code(s - 1) <= 0xdbff
        )
            s--;
        if (
            e < n &&
            code(e) >= 0xdc00 &&
            code(e) <= 0xdfff &&
            code(e - 1) >= 0xd800 &&
            code(e - 1) <= 0xdbff
        )
            e++;
        out.push([s, e]);
    }
    return out;
}

describe('computeSegments properties', () => {
    beforeAll(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('segments concatenate back to the original text', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                const s = computeSegments(text, highlights);
                expect(s.map((x) => x.text).join('')).toBe(text);
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
                const s = computeSegments(text, highlights);
                const ranges = normalizedRanges(text, highlights);
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

    it('ordering is deterministic', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                expect(computeSegments(text, highlights)).toEqual(
                    computeSegments(text, highlights),
                );
            }),
        );
    });

    it('never produces lone surrogates', () => {
        fc.assert(
            fc.property(inputArb, ({ text, highlights }) => {
                for (const seg of computeSegments(text, highlights)) {
                    expect(LONE.test(seg.text)).toBe(false);
                }
            }),
        );
    });
});
