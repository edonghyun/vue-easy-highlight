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
