import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const local = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
    // Source aliases: @overlapmark/adapter-contract imports @overlapmark/core,
    // which must resolve to these same sources (one module instance) rather
    // than to a built dist/. The contract package does not declare core as a
    // dependency, since core's tests depending on it would form a cycle.
    resolve: {
        alias: [
            {
                find: /^@overlapmark\/core\/dom$/,
                replacement: local('./src/dom/index.ts'),
            },
            {
                find: /^@overlapmark\/core$/,
                replacement: local('./src/index.ts'),
            },
            {
                find: /^@overlapmark\/adapter-contract\/fixtures$/,
                replacement: local('../adapter-contract/src/fixtures.ts'),
            },
            {
                find: /^@overlapmark\/adapter-contract$/,
                replacement: local('../adapter-contract/src/index.ts'),
            },
        ],
    },
    test: {
        passWithNoTests: true,
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
                test: {
                    name: 'perf',
                    environment: 'node',
                    include: ['test/perf/**/*.test.ts'],
                    fileParallelism: false,
                    retry: 2,
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
