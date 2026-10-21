import { describe, test } from 'vitest';
import { computeSegments, type Highlight } from '../src/index';

// Deterministic LCG so runs are comparable.
let seed = 42;
const rand = () =>
    (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const text = 'x'.repeat(100_000);
const highlights: Highlight[] = Array.from({ length: 1000 }, (_, i) => {
    const length = 5 + Math.floor(rand() * 496);
    const start = Math.floor(rand() * (text.length - length));
    return { id: `h${i}`, start, end: start + length };
});

describe('computeSegments', () => {
    test('100k chars, 1000 highlights (len 5-500)', async ({ bench }) => {
        await bench('computeSegments', () => {
            computeSegments(text, highlights);
        }).run();
    });
});
