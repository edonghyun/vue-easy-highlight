import { segmentsDataset } from '../../bench/dataset';
import { computeSegments } from '../../src/index';

// Dataset: "segments-100k-v1" from bench/dataset.ts (100,000 'x' characters,
// 1,000 highlights of length 5–500, LCG seed 42), shared with
// bench/segments.bench.ts.
const WARM_UP_RUNS = 20;
const SAMPLES = 30;

/** Median wall time in ms of computeSegments on the shared dataset (30 samples after 20 warm-ups). */
export function medianSegmentsMs(): number {
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
