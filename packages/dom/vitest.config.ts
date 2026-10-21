import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const core = (p: string): string =>
    fileURLToPath(new URL(`../core/src/${p}`, import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@overlapmark/core/styles.css',
                replacement: core('styles.css'),
            },
            {
                find: '@overlapmark/core/dom',
                replacement: core('dom/index.ts'),
            },
            { find: /^@overlapmark\/core$/, replacement: core('index.ts') },
        ],
    },
    test: {
        passWithNoTests: true,
        projects: [
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
