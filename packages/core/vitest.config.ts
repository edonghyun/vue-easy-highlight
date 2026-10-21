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
                    exclude: ['test/**/*.browser.test.ts'],
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
