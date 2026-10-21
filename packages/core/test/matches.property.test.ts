import { codePointBoundaries } from '@overlapmark/adapter-contract/fixtures';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findMatches } from '../src/matches';
import { textArb } from './helpers/text';

type Range = { start: number; end: number };

/** A text plus 1–3 queries, most of them substrings of the text so matches are common. */
const inputArb = textArb.chain((text) => {
    const bounds = codePointBoundaries(text);
    const substring = fc
        .tuple(fc.constantFrom(...bounds), fc.constantFrom(...bounds))
        .map(([a, b]) => text.slice(Math.min(a, b), Math.max(a, b)));
    const query = fc.oneof(
        { weight: 3, arbitrary: substring },
        { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 3 }) },
    );
    return fc.record({
        text: fc.constant(text),
        queries: fc.array(query, { minLength: 1, maxLength: 3 }),
    });
});

const optionsArb = fc.record({
    caseSensitive: fc.boolean(),
    overlapping: fc.boolean(),
    wholeWord: fc.boolean(),
});

/** Every exact occurrence of a non-empty query that starts on a code-point boundary. */
function bruteForceMatches(text: string, queries: string[]): Range[] {
    const found = new Map<string, Range>();
    for (const q of queries) {
        if (!q) continue;
        for (const start of codePointBoundaries(text)) {
            if (text.startsWith(q, start)) {
                const end = start + q.length;
                found.set(`${start}:${end}`, { start, end });
            }
        }
    }
    return [...found.values()].sort(
        (a, b) => a.start - b.start || a.end - b.end,
    );
}

describe('findMatches properties', () => {
    it('every case-sensitive match slices to one of the queries', () => {
        fc.assert(
            fc.property(inputArb, optionsArb, ({ text, queries }, options) => {
                const matches = findMatches(text, queries, {
                    ...options,
                    caseSensitive: true,
                });

                for (const m of matches) {
                    expect(queries).toContain(text.slice(m.start, m.end));
                }
            }),
        );
    });

    it('no match boundary falls inside a surrogate pair', () => {
        fc.assert(
            fc.property(inputArb, optionsArb, ({ text, queries }, options) => {
                const bounds = new Set(codePointBoundaries(text));

                const matches = findMatches(text, queries, options);

                for (const m of matches) {
                    expect(bounds.has(m.start)).toBe(true);
                    expect(bounds.has(m.end)).toBe(true);
                }
            }),
        );
    });

    it('results are sorted by start then end, without duplicates', () => {
        fc.assert(
            fc.property(inputArb, optionsArb, ({ text, queries }, options) => {
                const matches = findMatches(text, queries, options);

                for (let i = 1; i < matches.length; i++) {
                    const prev = matches[i - 1];
                    const cur = matches[i];
                    expect(
                        prev.start < cur.start ||
                            (prev.start === cur.start && prev.end < cur.end),
                    ).toBe(true);
                }
            }),
        );
    });

    it('finds every case-sensitive occurrence when caseSensitive is true', () => {
        fc.assert(
            fc.property(inputArb, ({ text, queries }) => {
                const expected = bruteForceMatches(text, queries);

                const matches = findMatches(text, queries, {
                    caseSensitive: true,
                });

                expect(matches).toEqual(expected);
            }),
        );
    });

    it('finds at least every case-sensitive match when case-insensitive', () => {
        fc.assert(
            fc.property(inputArb, ({ text, queries }) => {
                const sensitive = findMatches(text, queries, {
                    caseSensitive: true,
                });

                const insensitive = findMatches(text, queries);

                for (const m of sensitive)
                    expect(insensitive).toContainEqual(m);
            }),
        );
    });
});
