import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';
import { renderOnServer } from './test/server-render.ts';

export default defineConfig({
    plugins: [svelte()],
    resolve: { alias: workspaceAliases },
    // Pre-bundled up front: discovering it mid-run reloads the test page.
    // svelte/server is only loaded in Node (the node project and the
    // renderOnServer command), never by the page, so it needs no entry.
    optimizeDeps: { include: ['svelte'] },
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
