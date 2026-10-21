import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';
import { renderOnServer } from './test/server-render.ts';

export default defineConfig({
    plugins: [svelte()],
    resolve: { alias: workspaceAliases },
    // Pre-bundled up front: discovering them mid-run reloads the test page.
    optimizeDeps: { include: ['svelte', 'svelte/server'] },
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
                        commands: { renderOnServer },
                    },
                },
            },
        ],
    },
});
