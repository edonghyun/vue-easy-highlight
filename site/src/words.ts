export interface Range {
    start: number;
    end: number;
}

/** One `[start, end)` range per run of non-whitespace in `text`. */
export function wordRanges(text: string): Range[] {
    return [...text.matchAll(/\S+/g)].map((m) => ({
        start: m.index,
        end: m.index + m[0].length,
    }));
}

/**
 * A range covering `minWords` to `maxWords` whole words, picked with `rand`
 * (a function returning [0, 1), injected so tests can fix it).
 */
export function randomWordRange(
    words: readonly Range[],
    rand: () => number,
    minWords = 2,
    maxWords = 8,
): Range {
    const count = Math.min(
        words.length,
        minWords + Math.floor(rand() * (maxWords - minWords + 1)),
    );
    const first = Math.floor(rand() * (words.length - count + 1));
    return { start: words[first]!.start, end: words[first + count - 1]!.end };
}
