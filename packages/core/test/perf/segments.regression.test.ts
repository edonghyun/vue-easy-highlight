import { describe, expect, it } from 'vitest';
import { medianSegmentsMs } from '../helpers/perf';

// Regression ceiling, pinned from measurement. Runs only in the `perf`
// project (`pnpm test:perf`), alone and with `retry: 2`, never inside the
// concurrent node/browser test run.
//
// Measured on a dev laptop (node 22): median of 30 samples after 20 warm-ups
// 0.44–0.56 ms over three runs; the bench reports a 0.37–0.40 ms mean over
// ~2,700 samples. 4 ms allows roughly 8x while still catching an accidental
// quadratic step, which costs tens of milliseconds here. This tolerance has
// not been measured on CI: re-pin it from CI medians once they are available.
const REGRESSION_CEILING_MS = 4;

describe('computeSegments on 100k characters with 1,000 highlights', () => {
    it('stays under the measured regression ceiling', () => {
        const median = medianSegmentsMs();

        expect(median).toBeLessThan(REGRESSION_CEILING_MS);
    });
});
