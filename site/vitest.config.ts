import { defineConfig } from 'vitest/config';
import { workspaceAliases } from '../vitest.workspace-aliases.ts';

// Unit tests of the site's data modules. The pages themselves are tested by
// Playwright in e2e/ against the production build.
export default defineConfig({
    resolve: { alias: workspaceAliases },
    test: {
        name: 'site',
        root: import.meta.dirname,
        include: ['src/**/*.test.ts'],
        environment: 'node',
    },
});
