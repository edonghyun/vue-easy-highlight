import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    compareHighlights,
    computeSegments,
    highlightsInRange,
    segmentAt,
} from '../src/index';
import { resetWarnings } from '../src/warn';

const t = 'Hello wonderful world'; // length 21
const A = { id: 'a', start: 0, end: 15 };
const B = { id: 'b', start: 6, end: 21 };

beforeEach(() => {
    resetWarnings();
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('computeSegments', () => {
    it('covers the whole text with depth-0 segments when there are no highlights', () => {
        expect(computeSegments(t, [])).toEqual([
            { start: 0, end: 21, text: t, highlights: [], depth: 0 },
        ]);
    });
    it('returns [] for empty text', () => {
        expect(computeSegments('', [A])).toEqual([]);
    });
    it('splits partial overlap into three segments', () => {
        const s = computeSegments(t, [A, B]);
        expect(s.map((x) => [x.start, x.end, x.depth])).toEqual([
            [0, 6, 1],
            [6, 15, 2],
            [15, 21, 1],
        ]);
        expect(s[1].highlights.map((h) => h.id)).toEqual(['a', 'b']);
    });
    it('orders containing highlight outside the contained one', () => {
        const inner = { id: 'inner', start: 6, end: 15 };
        const outer = { id: 'outer', start: 6, end: 21 };
        const s = computeSegments(t, [inner, outer]);
        expect(segmentAt(s, 8)!.highlights.map((h) => h.id)).toEqual([
            'outer',
            'inner',
        ]);
    });
    it('keeps input order for identical ranges', () => {
        const s = computeSegments(t, [
            { id: 'x', start: 0, end: 5 },
            { id: 'y', start: 0, end: 5 },
        ]);
        expect(s[0].highlights.map((h) => h.id)).toEqual(['x', 'y']);
    });
    it('does not merge adjacent highlights', () => {
        const s = computeSegments(t, [
            { id: 'p', start: 0, end: 5 },
            { id: 'q', start: 5, end: 10 },
        ]);
        expect(s.slice(0, 2).map((x) => x.highlights.map((h) => h.id))).toEqual(
            [['p'], ['q']],
        );
    });
    it('handles invalid and stale ranges deterministically', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = computeSegments('abc', [
            { id: 'neg', start: -5, end: 2 }, // clamp -> [0,2)
            { id: 'far', start: 1, end: 999 }, // clamp -> [1,3)
            { id: 'rev', start: 2, end: 1 }, // dropped
            { id: 'out', start: 10, end: 20 }, // clamp -> empty -> dropped
            { id: 'neg', start: 0, end: 1 }, // duplicate id kept
        ]);
        expect(
            s.map((x) => [x.start, x.end, x.highlights.map((h) => h.id)]),
        ).toEqual([
            [0, 1, ['neg', 'neg']],
            [1, 2, ['neg', 'far']],
            [2, 3, ['far']],
        ]);
        expect(warn).toHaveBeenCalled();
    });
    it('warns once per distinct problem', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        computeSegments('abc', [{ id: 'rev', start: 2, end: 1 }]);
        computeSegments('abc', [{ id: 'rev', start: 2, end: 1 }]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('rev');
    });
    it('widens boundaries that fall inside a surrogate pair', () => {
        const e = 'a😀b'; // 😀 = indices 1..3
        const s = computeSegments(e, [{ id: 'h', start: 2, end: 3 }]);
        expect(s.map((x) => x.text)).toEqual(['a', '😀', 'b']);
    });
    it('returns caller highlight objects by reference', () => {
        expect(computeSegments(t, [A])[0].highlights[0]).toBe(A);
    });
});

describe('segmentAt / highlightsInRange / compareHighlights', () => {
    it('segmentAt finds by half-open range', () => {
        const s = computeSegments(t, [A]);
        expect(segmentAt(s, 14)!.start).toBe(0);
        expect(segmentAt(s, 15)!.start).toBe(15);
        expect(segmentAt(s, 21)).toBeUndefined();
        expect(segmentAt(s, -1)).toBeUndefined();
    });
    it('highlightsInRange returns overlapping highlights in order without duplicates', () => {
        const s = computeSegments(t, [B, A]);
        expect(highlightsInRange(s, 10, 18).map((h) => h.id)).toEqual([
            'a',
            'b',
        ]);
        expect(highlightsInRange(s, 15, 15)).toEqual([]);
    });
    it('compareHighlights: start, then longer first, then index', () => {
        const idx = (h: unknown) => (h === A ? 0 : 1);
        expect(compareHighlights(A, B, idx)).toBeLessThan(0);
        expect(
            compareHighlights({ id: 'l', start: 0, end: 9 }, A, idx),
        ).toBeGreaterThan(0);
        expect(compareHighlights(A, { ...A }, idx)).toBeLessThan(0);
    });
});
