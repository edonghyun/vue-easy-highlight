import { describe, expect, it } from 'vitest';
import { medianSegmentsMs } from './helpers/perf';

// Spec target: 100k characters with 1,000 highlights segment in under 10 ms.
// The tighter regression ceiling lives in test/perf/ (the `perf` project).
const SPEC_TARGET_MS = 10;

describe('computeSegments on 100k characters with 1,000 highlights', () => {
    it('finishes within the 10 ms spec target', () => {
        const median = medianSegmentsMs();

        expect(median).toBeLessThan(SPEC_TARGET_MS);
    });
});
