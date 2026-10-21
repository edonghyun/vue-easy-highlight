import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';

export default defineConfig({
    resolve: { alias: workspaceAliases },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['test/**/*.test.ts'],
                    exclude: ['test/**/*.browser.test.ts', 'test/perf/**'],
                },
            },
            {
                extends: true,
                // Measured regression ceilings: run alone via `pnpm test:perf`
                // so timings are not skewed by the concurrent default projects.
                // No retry: a miss fails.
                test: {
                    name: 'perf',
                    environment: 'node',
                    include: ['test/perf/**/*.test.ts'],
                    fileParallelism: false,
                },
            },
            {
                extends: true,
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
