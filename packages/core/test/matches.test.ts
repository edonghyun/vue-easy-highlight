import { describe, expect, it } from 'vitest';
import { findMatches } from '../src/matches';

describe('findMatches', () => {
    it('finds case-insensitive matches by default', () => {
        expect(findMatches('Type type TYPE', 'type')).toEqual([
            { start: 0, end: 4 },
            { start: 5, end: 9 },
            { start: 10, end: 14 },
        ]);
    });

    it('respects caseSensitive', () => {
        expect(
            findMatches('Type type', 'type', { caseSensitive: true }),
        ).toEqual([{ start: 5, end: 9 }]);
    });

    it('folds non-ASCII letters when case-insensitive', () => {
        expect(findMatches('É é', 'é')).toEqual([
            { start: 0, end: 1 },
            { start: 2, end: 3 },
        ]);
    });

    it('returns overlapping matches by default', () => {
        expect(findMatches('aaaa', 'aa')).toEqual([
            { start: 0, end: 2 },
            { start: 1, end: 3 },
            { start: 2, end: 4 },
        ]);
    });

    it('resumes after each match when overlapping is false', () => {
        expect(findMatches('aaaa', 'aa', { overlapping: false })).toEqual([
            { start: 0, end: 2 },
            { start: 2, end: 4 },
        ]);
    });

    it('treats hyphens, slashes and brackets literally', () => {
        expect(findMatches('a-b/c [x]', '-b/c [x]')).toEqual([
            { start: 1, end: 9 },
        ]);
    });

    it('treats regex characters literally', () => {
        expect(findMatches('a.b axb', 'a.b')).toEqual([{ start: 0, end: 3 }]);
    });

    it('accepts multiple queries and returns results sorted by start then end', () => {
        expect(findMatches('ab ab', ['b', 'ab'])).toEqual([
            { start: 0, end: 2 },
            { start: 1, end: 2 },
            { start: 3, end: 5 },
            { start: 4, end: 5 },
        ]);
    });

    it('returns a range matched by several queries once', () => {
        expect(findMatches('Ab', ['ab', 'AB'])).toEqual([{ start: 0, end: 2 }]);
    });

    it('returns the same results when a query is repeated', () => {
        expect(findMatches('ab ab', ['ab', 'ab'])).toEqual([
            { start: 0, end: 2 },
            { start: 3, end: 5 },
        ]);
    });

    it('ignores empty queries', () => {
        expect(findMatches('abc', ['', 'b'])).toEqual([{ start: 1, end: 2 }]);
    });

    it('keeps indices aligned for Korean and emoji', () => {
        const text = '😀 하이라이트 😀';

        const [m] = findMatches(text, '하이라이트');

        expect(text.slice(m!.start, m!.end)).toBe('하이라이트');
    });
});

describe('findMatches next to surrogate pairs', () => {
    it('never starts or ends inside a pair with overlapping matches', () => {
        expect(findMatches('😀😀😀', '😀😀')).toEqual([
            { start: 0, end: 4 },
            { start: 2, end: 6 },
        ]);
    });

    it('never starts or ends inside a pair when overlapping is false', () => {
        expect(findMatches('😀😀😀', '😀😀', { overlapping: false })).toEqual([
            { start: 0, end: 4 },
        ]);
    });

    // A hang here means the search no longer advances a whole code point after a match.
    it('finds every occurrence of an astral query and terminates', () => {
        expect(findMatches('😀😀😀', '😀')).toEqual([
            { start: 0, end: 2 },
            { start: 2, end: 4 },
            { start: 4, end: 6 },
        ]);
    });
});

describe('findMatches with wholeWord', () => {
    it('excludes matches inside words', () => {
        expect(
            findMatches('cat concat cat.', 'cat', { wholeWord: true }),
        ).toEqual([
            { start: 0, end: 3 },
            { start: 11, end: 14 },
        ]);
    });

    it('treats an astral letter before the match as a word character', () => {
        expect(findMatches('𝒜a a', 'a', { wholeWord: true })).toEqual([
            { start: 4, end: 5 },
        ]);
    });

    it('treats an astral letter after the match as a word character', () => {
        expect(findMatches('a𝒜 a', 'a', { wholeWord: true })).toEqual([
            { start: 4, end: 5 },
        ]);
    });

    it('treats Hangul on either side as a word character', () => {
        expect(
            findMatches('한abc abc한 abc', 'abc', { wholeWord: true }),
        ).toEqual([{ start: 10, end: 13 }]);
    });
});
