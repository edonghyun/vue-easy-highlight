import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { medianSegmentsMs } from '../helpers/perf';

// Regression ceiling, pinned from measurement. Runs only in the `perf`
// project (`pnpm test:perf`), alone and without retries, never inside the
// concurrent node/browser test run.
//
// Pinned at the observed CI max × 1.5, rounded up to 0.5 ms. Measured by
// perf.yml on ubuntu-latest (node 22.22.0), 20 runs each, the median of 30
// samples after 20 warm-ups per run:
//   run 39669500741: 1.04–1.57 ms
//   run 39670474615: 1.05–1.95 ms
// Max 1.95 ms × 1.5 = 2.92 ms → 3 ms. An accidental quadratic step costs
// 10+ ms even on a dev laptop (measured 10.6–16 ms; medians there are
// 0.4–0.56 ms), so it fails here.
const REGRESSION_CEILING_MS = 3;

describe('computeSegments on 100k characters with 1,000 highlights', () => {
    it('stays under the measured regression ceiling', () => {
        const median = medianSegmentsMs();
        // perf.yml collects each run's median here to re-pin the ceiling.
        const out = process.env.OM_PERF_OUT;
        if (out) appendFileSync(out, `${median}\n`);

        expect(median).toBeLessThan(REGRESSION_CEILING_MS);
    });
});
