import { computeSegments } from '@overlapmark/core';
import { describe, expect, test } from 'vitest';
import { hueSpread } from './palette';
import { QUICK_STARTS } from './quick-starts';
import { SAMPLES, type Sample } from './samples';

const named: [string, Sample][] = [
    ['hero', SAMPLES.hero],
    ['passage', SAMPLES.passage],
    ['styling', SAMPLES.styling],
    ['modes', SAMPLES.modes],
    ...[1, 2, 3, 4, 5, 6].map((n): [string, Sample] => [
        `layers(${n})`,
        SAMPLES.layers(n),
    ]),
];

describe.each(named)('%s', (_, sample) => {
    test('stacks no colors more than 75 degrees of hue apart', () => {
        for (const segment of computeSegments(sample.text, sample.highlights)) {
            const colors = segment.highlights.map((h) => h.color!);
            expect(hueSpread(colors)).toBeLessThanOrEqual(75);
        }
    });

    test('gives every highlight a color, a label and a unique id', () => {
        const ids = sample.highlights.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const h of sample.highlights) {
            expect(h.color).toMatch(/^#[0-9a-f]{6}$/i);
            expect(h.data?.label).toBeTruthy();
        }
    });
});

test('the hue check rejects blue over orange', () => {
    expect(hueSpread(['#8cbcff', '#ffb066'])).toBeGreaterThan(75);
});

test.each([1, 2, 3, 4, 5, 6])('layers(%i) nests that many highlights', (n) => {
    const sample = SAMPLES.layers(n);
    expect(sample.highlights).toHaveLength(n);
    const depths = computeSegments(sample.text, sample.highlights).map(
        (s) => s.highlights.length,
    );
    expect(Math.max(...depths)).toBe(n);
});

test('QUICK_STARTS has one entry per README quick start', () => {
    expect(Object.keys(QUICK_STARTS)).toEqual([
        'vanilla JS',
        'Vue',
        'React',
        'Svelte',
    ]);
});
