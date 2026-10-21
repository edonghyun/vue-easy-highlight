import type { Highlight } from '../src/index';

/**
 * Deterministic LCG (Numerical Recipes constants) returning floats in [0, 1).
 * Each call owns its state, so a dataset never depends on evaluation order.
 */
export function makeRng(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

export interface SegmentsDataset {
    text: string;
    highlights: Highlight[];
}

/**
 * Dataset "segments-100k-v1": the spec's performance target input
 * (100,000 characters, 1,000 highlights). Text is `'x'.repeat(100_000)`;
 * highlight lengths are uniform in 5–500, starts uniform over the text,
 * LCG seed 42. The text is plain ASCII, so surrogate-pair widening never
 * runs on this dataset.
 */
export function segmentsDataset(): SegmentsDataset {
    const rand = makeRng(42);
    const text = 'x'.repeat(100_000);
    const highlights: Highlight[] = Array.from({ length: 1000 }, (_, i) => {
        const length = 5 + Math.floor(rand() * 496);
        const start = Math.floor(rand() * (text.length - length));
        return { id: `h${i}`, start, end: start + length };
    });
    return { text, highlights };
}
