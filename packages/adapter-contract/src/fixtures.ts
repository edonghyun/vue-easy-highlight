// Inputs shared by the contract suite. Fixtures only build data; they do not
// mount anything or check results.
import type { Highlight } from '@overlapmark/core';

export interface Fixture {
    name: string;
    text: string;
    highlights: readonly Highlight[];
}

/** Latin, an emoji (a surrogate pair at 22–23) and Hangul; 30 code units. */
export const TEXT = 'Hello wonderful world 😀 하이라이트';

/** `a` covers "Hello wonderful", `b` covers "wonderful world". */
export const a: Highlight = { id: 'a', start: 0, end: 15 };
export const b: Highlight = { id: 'b', start: 6, end: 21 };

/**
 * Two partially overlapping highlights. Segments: [0,6) a · [6,15) a+b ·
 * [15,21) b · [21,30) plain.
 */
export const partialOverlap: Fixture = {
    name: 'partial overlap',
    text: TEXT,
    highlights: [a, b],
};

/** A colored highlight that fully contains one with a className. */
export const nested: Fixture = {
    name: 'nested',
    text: TEXT,
    highlights: [
        { id: 'outer', start: 0, end: 21, color: '#ffd54f' },
        { id: 'inner', start: 6, end: 15, className: 'note' },
    ],
};

/** Two highlights that touch at offset 5 without overlapping. */
export const adjacent: Fixture = {
    name: 'adjacent',
    text: TEXT,
    highlights: [
        { id: 'left', start: 0, end: 5 },
        { id: 'right', start: 5, end: 15, color: 'rgb(144, 202, 249)' },
    ],
};

/** Highlights whose boundaries sit on the emoji and inside the Hangul word. */
export const emojiKorean: Fixture = {
    name: 'emoji and Hangul',
    text: TEXT,
    highlights: [
        { id: 'emoji', start: 22, end: 30 },
        { id: 'hangul', start: 25, end: 27, className: 'term' },
    ],
};

export const fixtures: readonly Fixture[] = [
    partialOverlap,
    nested,
    adjacent,
    emojiKorean,
];

/** A third highlight used to change the input of a mounted adapter. */
export const c: Highlight = { id: 'c', start: 10, end: 24 };

/**
 * Every UTF-16 index of `text` that starts a code point, plus `text.length`.
 * Derived from string iteration, independently of how core finds surrogates.
 */
export function codePointBoundaries(text: string): number[] {
    const bounds = [0];
    let i = 0;
    for (const ch of text) {
        i += ch.length;
        bounds.push(i);
    }
    return bounds;
}

/** Every [start, end) pair of `text` with start < end on code point boundaries. */
export function codePointRanges(text: string): [number, number][] {
    const bounds = codePointBoundaries(text);
    const pairs: [number, number][] = [];
    for (const start of bounds) {
        for (const end of bounds) {
            if (start < end) pairs.push([start, end]);
        }
    }
    return pairs;
}
