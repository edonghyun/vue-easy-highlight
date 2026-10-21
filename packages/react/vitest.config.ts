import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';

export default defineConfig({
    resolve: { alias: workspaceAliases },
    // Pre-bundled up front: discovering them mid-run reloads the test page.
    optimizeDeps: {
        include: [
            'react',
            'react/jsx-dev-runtime',
            'react-dom',
            'react-dom/client',
            'react-dom/server',
        ],
    },
    test: {
        projects: [
            {
                extends: true,
                // Server rendering with no window or document, as on a real server.
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['test/**/*.node.test.tsx'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['test/**/*.browser.test.tsx'],
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
