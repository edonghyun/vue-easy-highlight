import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';

export default defineConfig({
    resolve: { alias: workspaceAliases },
    // The compile-time flags of Vue's esm-bundler build, which otherwise
    // warns on first use; hydration mismatch details keep test failures readable.
    define: {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
    },
    // Pre-bundled up front: discovering them mid-run reloads the test page.
    optimizeDeps: { include: ['vue', 'vue/server-renderer'] },
    test: {
        passWithNoTests: true,
        projects: [
            {
                extends: true,
                // Server rendering with no window or document, as on a real server.
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['test/**/*.node.test.ts'],
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
