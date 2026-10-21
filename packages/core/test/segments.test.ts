import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    compareHighlights,
    computeSegments,
    highlightsInRange,
    segmentAt,
    type Highlight,
    type Segment,
} from '../src/index';

const text = 'Hello wonderful world'; // length 21
const A = { id: 'a', start: 0, end: 15 };
const B = { id: 'b', start: 6, end: 21 };

afterEach(() => {
    vi.restoreAllMocks();
});

function silenceWarnings() {
    return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

/**
 * Loads the package entry from a fresh module graph, so no dev warning counts
 * as already emitted by an earlier test.
 */
async function givenFreshCore() {
    vi.resetModules();
    return import('../src/index');
}

function expectIds(highlights: readonly Highlight[], ids: string[]): void {
    expect(highlights.map((h) => h.id)).toEqual(ids);
}

/** `[start, end, highlight ids]` per segment. */
function layout(segments: readonly Segment[]): [number, number, string[]][] {
    return segments.map((s) => [s.start, s.end, s.highlights.map((h) => h.id)]);
}

describe('computeSegments', () => {
    it('covers the whole text with one depth-0 segment when there are no highlights', () => {
        const segments = computeSegments(text, []);

        expect(segments).toEqual([
            { start: 0, end: 21, text, highlights: [], depth: 0 },
        ]);
    });

    it('returns [] for empty text', () => {
        expect(computeSegments('', [A])).toEqual([]);
    });

    it('splits a partial overlap into three segments', () => {
        const segments = computeSegments(text, [A, B]);

        expect(segments.map((x) => [x.start, x.end, x.depth])).toEqual([
            [0, 6, 1],
            [6, 15, 2],
            [15, 21, 1],
        ]);
        expectIds(segments[1].highlights, ['a', 'b']);
    });

    it('orders a containing highlight outside the contained one', () => {
        const inner = { id: 'inner', start: 6, end: 15 };
        const outer = { id: 'outer', start: 6, end: 21 };

        const segments = computeSegments(text, [inner, outer]);

        expectIds(segmentAt(segments, 8)!.highlights, ['outer', 'inner']);
    });

    it('keeps input order for identical ranges', () => {
        const x = { id: 'x', start: 0, end: 5 };
        const y = { id: 'y', start: 0, end: 5 };

        const segments = computeSegments(text, [x, y]);

        expectIds(segments[0].highlights, ['x', 'y']);
    });

    it('does not merge adjacent highlights', () => {
        const p = { id: 'p', start: 0, end: 5 };
        const q = { id: 'q', start: 5, end: 10 };

        const segments = computeSegments(text, [p, q]);

        expect(layout(segments.slice(0, 2))).toEqual([
            [0, 5, ['p']],
            [5, 10, ['q']],
        ]);
    });

    it('widens boundaries that fall inside a surrogate pair', () => {
        const emoji = 'a😀b'; // 😀 = indices 1..3

        const segments = computeSegments(emoji, [
            { id: 'h', start: 2, end: 3 },
        ]);

        expect(segments.map((x) => x.text)).toEqual(['a', '😀', 'b']);
    });

    it('returns caller highlight objects by reference', () => {
        const segments = computeSegments(text, [A]);

        expect(segments[0].highlights[0]).toBe(A);
    });
});

describe('computeSegments with invalid or stale ranges', () => {
    beforeEach(() => {
        silenceWarnings();
    });

    it('clamps a start below 0 to 0', () => {
        const segments = computeSegments('abc', [
            { id: 'neg', start: -5, end: 2 },
        ]);

        expect(layout(segments)).toEqual([
            [0, 2, ['neg']],
            [2, 3, []],
        ]);
    });

    it('clamps an end past the text to the text length', () => {
        const segments = computeSegments('abc', [
            { id: 'far', start: 1, end: 999 },
        ]);

        expect(layout(segments)).toEqual([
            [0, 1, []],
            [1, 3, ['far']],
        ]);
    });

    it('drops a reversed range', () => {
        const segments = computeSegments('abc', [
            { id: 'rev', start: 2, end: 1 },
        ]);

        expect(layout(segments)).toEqual([[0, 3, []]]);
    });

    it('drops a range that lies entirely past the text', () => {
        const segments = computeSegments('abc', [
            { id: 'out', start: 10, end: 20 },
        ]);

        expect(layout(segments)).toEqual([[0, 3, []]]);
    });

    it.each([
        { start: Number.NaN, end: 2 },
        { start: 0, end: 1.5 },
        { start: 0, end: Number.POSITIVE_INFINITY },
    ])('drops a non-integer range [$start, $end)', ({ start, end }) => {
        const segments = computeSegments('abc', [{ id: 'frac', start, end }]);

        expect(layout(segments)).toEqual([[0, 3, []]]);
    });

    it('keeps every highlight that shares a duplicate id', () => {
        const first = { id: 'dup', start: 0, end: 2 };
        const second = { id: 'dup', start: 0, end: 1 };

        const segments = computeSegments('abc', [first, second]);

        expect(segments[0].highlights).toEqual([first, second]);
    });

    it('normalizes each highlight on its own when invalid ranges are mixed', () => {
        const segments = computeSegments('abc', [
            { id: 'neg', start: -5, end: 2 },
            { id: 'far', start: 1, end: 999 },
            { id: 'rev', start: 2, end: 1 },
            { id: 'out', start: 10, end: 20 },
            { id: 'neg', start: 0, end: 1 },
        ]);

        expect(layout(segments)).toEqual([
            [0, 1, ['neg', 'neg']],
            [1, 2, ['neg', 'far']],
            [2, 3, ['far']],
        ]);
    });
});

describe('computeSegments dev warnings', () => {
    it('warns once for an id that contains whitespace', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();
        const spaced = { id: 'two words', start: 0, end: 2 };

        core.computeSegments('abc', [spaced]);
        core.computeSegments('abc', [spaced]);
        core.computeSegments('abc', [{ id: 'fine', start: 0, end: 2 }]);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] highlight id "two words" contains whitespace; ids are space-separated in data-om-ids',
        );
    });

    it('reports a clamped range', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [{ id: 'far', start: 1, end: 999 }]);

        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] Highlight "far" range [1, 999) clamped to text length 3',
        );
    });

    it('reports a reversed range as dropped', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [{ id: 'rev', start: 2, end: 1 }]);

        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] Highlight "rev" range [2, 1) is empty or reversed; dropped',
        );
    });

    it('reports a range that is empty after clamping as dropped', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [{ id: 'out', start: 10, end: 20 }]);

        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] Highlight "out" range [10, 20) is empty or reversed; dropped',
        );
    });

    it('reports a non-integer range as dropped', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [{ id: 'frac', start: 0, end: 1.5 }]);

        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] Highlight "frac" has a non-integer range; dropped',
        );
    });

    it('reports a duplicate highlight id', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [
            { id: 'dup', start: 0, end: 2 },
            { id: 'dup', start: 0, end: 1 },
        ]);

        expect(warn).toHaveBeenCalledWith(
            '[overlapmark] Duplicate highlight id "dup"',
        );
    });

    it('reports each distinct problem only once', async () => {
        const warn = silenceWarnings();
        const core = await givenFreshCore();

        core.computeSegments('abc', [{ id: 'rev', start: 2, end: 1 }]);
        core.computeSegments('abc', [{ id: 'rev', start: 2, end: 1 }]);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('rev');
    });
});

describe('segmentAt', () => {
    it('returns the segment whose half-open range contains the offset', () => {
        const segments = computeSegments(text, [A]);

        expect(segmentAt(segments, 14)!.start).toBe(0);
        expect(segmentAt(segments, 15)!.start).toBe(15);
    });

    it('returns undefined for offsets outside the text', () => {
        const segments = computeSegments(text, [A]);

        expect(segmentAt(segments, 21)).toBeUndefined();
        expect(segmentAt(segments, -1)).toBeUndefined();
    });
});

describe('highlightsInRange', () => {
    it('returns each overlapping highlight once, in highlight order', () => {
        const segments = computeSegments(text, [B, A]);

        const highlights = highlightsInRange(segments, 10, 18);

        expectIds(highlights, ['a', 'b']);
    });

    it('returns [] for an empty range', () => {
        const segments = computeSegments(text, [B, A]);

        expect(highlightsInRange(segments, 15, 15)).toEqual([]);
    });

    it('orders by the clamped ranges, the same as the segments do', () => {
        silenceWarnings();
        const a = { id: 'a', start: -5, end: 2 };
        const b = { id: 'b', start: 0, end: 3 };
        const segments = computeSegments('abc', [a, b]);

        const highlights = highlightsInRange(segments, 0, 3);

        expectIds(segments[0].highlights, ['b', 'a']);
        expectIds(highlights, ['b', 'a']);
    });

    it('returns the same order for copies of the segments', () => {
        silenceWarnings();
        const a = { id: 'a', start: -5, end: 2 };
        const b = { id: 'b', start: 0, end: 3 };
        const copies = computeSegments('abc', [a, b]).map((x) => ({
            ...x,
            highlights: [...x.highlights],
        }));

        expectIds(highlightsInRange(copies, 0, 3), ['b', 'a']);
        expectIds(highlightsInRange(copies, 1, 3), ['b', 'a']);
    });
});

describe('compareHighlights', () => {
    const inputIndex = (h: Highlight) => (h === A ? 0 : 1);

    it.each([
        {
            rule: 'puts the earlier start first',
            first: A,
            second: B,
            sign: -1,
        },
        {
            rule: 'puts the longer highlight first at the same start',
            first: { id: 'l', start: 0, end: 9 },
            second: A,
            sign: 1,
        },
        {
            rule: 'falls back to input order for identical ranges',
            first: A,
            second: { ...A },
            sign: -1,
        },
    ])('$rule', ({ first, second, sign }) => {
        const result = compareHighlights(first, second, inputIndex);

        expect(Math.sign(result)).toBe(sign);
    });
});
