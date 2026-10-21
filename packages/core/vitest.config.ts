import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        passWithNoTests: true,
        projects: [
            {
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['test/**/*.test.ts'],
                    exclude: ['test/**/*.browser.test.ts', 'test/perf/**'],
                },
            },
            {
                // Measured regression ceilings: run alone via `pnpm test:perf`
                // so timings are not skewed by the concurrent default projects.
                test: {
                    name: 'perf',
                    environment: 'node',
                    include: ['test/perf/**/*.test.ts'],
                    fileParallelism: false,
                    retry: 2,
                },
            },
            {
                test: {
                    name: 'browser',
                    include: ['test/**/*.browser.test.ts'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
        ],
    },
});
