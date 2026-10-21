import { describe, expect, it } from 'vitest';
import { segmentsDataset } from '../bench/dataset';
import { computeSegments } from '../src/index';

// Dataset: "segments-100k-v1" from bench/dataset.ts (100,000 'x' characters,
// 1,000 highlights of length 5–500, LCG seed 42), shared with
// bench/segments.bench.ts.
const WARM_UP_RUNS = 20;
const SAMPLES = 30;

// Spec target: 100k characters with 1,000 highlights segment in under 10 ms.
const SPEC_TARGET_MS = 10;

// Regression ceiling, pinned from measurement. Measured median of 30 samples
// after 20 warm-ups: 0.44–0.56 ms (node 22, dev laptop, three runs); the
// bench reports a 0.37–0.40 ms mean over ~2,700 samples. 4 ms allows roughly
// 8x for slower CI runners and parallel test files while still catching an
// accidental quadratic step, which would cost tens of milliseconds here.
const REGRESSION_CEILING_MS = 4;

function medianSegmentsMs(): number {
    const { text, highlights } = segmentsDataset();
    for (let i = 0; i < WARM_UP_RUNS; i++) computeSegments(text, highlights);
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
        const t0 = performance.now();
        computeSegments(text, highlights);
        samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(SAMPLES / 2)];
}

describe('computeSegments on 100k characters with 1,000 highlights', () => {
    it('finishes within the 10 ms spec target', () => {
        const median = medianSegmentsMs();

        expect(median).toBeLessThan(SPEC_TARGET_MS);
    });

    // A retry absorbs a one-off scheduling stall on a shared runner; a real
    // regression fails all three attempts.
    it('stays under the measured regression ceiling', { retry: 2 }, () => {
        const median = medianSegmentsMs();

        expect(median).toBeLessThan(REGRESSION_CEILING_MS);
    });
});
