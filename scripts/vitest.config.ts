import { defineConfig } from 'vitest/config';

// The repository scripts' own unit tests.
export default defineConfig({
    test: {
        name: 'scripts',
        root: import.meta.dirname,
        include: ['*.test.ts'],
        environment: 'node',
    },
});
