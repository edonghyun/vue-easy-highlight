import { expect, test } from 'vitest';
import { randomWordRange, wordRanges } from './words';

test('wordRanges returns one range per run of non-whitespace', () => {
    expect(wordRanges('a  bc d')).toEqual([
        { start: 0, end: 1 },
        { start: 3, end: 5 },
        { start: 6, end: 7 },
    ]);
});

const text = 'one two three four five six seven eight nine ten';
const words = wordRanges(text);

test('the lowest draw starts at the first word and spans minWords words', () => {
    expect(randomWordRange(words, () => 0)).toEqual({
        start: words[0]!.start,
        end: words[1]!.end,
    });
});

test('the highest draw ends inside the text', () => {
    const { end } = randomWordRange(words, () => 0.999999);
    expect(end).toBeLessThanOrEqual(words.at(-1)!.end);
});

test('random ranges start and end on word boundaries', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const starts = new Set(words.map((w) => w.start));
    const ends = new Set(words.map((w) => w.end));
    for (let i = 0; i < 200; i++) {
        const { start, end } = randomWordRange(words, rand);
        expect(starts.has(start)).toBe(true);
        expect(ends.has(end)).toBe(true);
        expect(end).toBeGreaterThan(start);
    }
});
