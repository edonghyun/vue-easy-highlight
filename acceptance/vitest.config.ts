import { defineConfig } from 'vitest/config';

// Only the pipeline's own unit tests run under Vitest; the specs under
// specs/ are Playwright Test files.
export default defineConfig({
    test: {
        name: 'acceptance-scripts',
        root: import.meta.dirname,
        include: ['scripts/**/*.test.ts'],
        environment: 'node',
    },
});
