import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { workspaceAliases } from '../vitest.workspace-aliases.ts';

// Two pages: the demo (index.html) and the docs (docs/index.html). The
// workspace packages resolve to their sources, so the site runs without
// building them first. The Pages build serves it from a subpath with
// `vite build --base /overlapmark/` (see .github/workflows/pages.yml); every
// other build keeps the default base.
export default defineConfig({
    resolve: { alias: workspaceAliases },
    build: {
        rolldownOptions: {
            input: {
                main: resolve(import.meta.dirname, 'index.html'),
                docs: resolve(import.meta.dirname, 'docs/index.html'),
            },
        },
    },
});
