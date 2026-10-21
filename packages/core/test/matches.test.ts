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
    it('returns overlapping matches by default and not when disabled', () => {
        expect(findMatches('aaaa', 'aa')).toEqual([
            { start: 0, end: 2 },
            { start: 1, end: 3 },
            { start: 2, end: 4 },
        ]);
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
    it('wholeWord excludes matches inside words', () => {
        expect(
            findMatches('cat concat cat.', 'cat', { wholeWord: true }),
        ).toEqual([
            { start: 0, end: 3 },
            { start: 11, end: 14 },
        ]);
    });
    it('accepts multiple queries and returns results sorted by start then end', () => {
        expect(findMatches('ab ab', ['b', 'ab'])).toEqual([
            { start: 0, end: 2 },
            { start: 1, end: 2 },
            { start: 3, end: 5 },
            { start: 4, end: 5 },
        ]);
    });
    it('ignores empty queries', () => {
        expect(findMatches('abc', ['', 'b'])).toEqual([{ start: 1, end: 2 }]);
    });
    it('keeps indices aligned for Korean and emoji', () => {
        const text = '😀 하이라이트 😀';
        const [m] = findMatches(text, '하이라이트');
        expect(text.slice(m.start, m.end)).toBe('하이라이트');
    });
    it('never starts or ends inside a surrogate pair and terminates', () => {
        expect(findMatches('😀😀😀', '😀😀')).toEqual([
            { start: 0, end: 4 },
            { start: 2, end: 6 },
        ]);
        expect(findMatches('😀😀😀', '😀😀', { overlapping: false })).toEqual([
            { start: 0, end: 4 },
        ]);
        expect(findMatches('😀😀😀', '😀')).toHaveLength(3);
    });
    it('wholeWord treats astral letters as word characters', () => {
        expect(findMatches('𝒜a a', 'a', { wholeWord: true })).toEqual([
            { start: 4, end: 5 },
        ]);
    });
});
