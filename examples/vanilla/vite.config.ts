import { defineConfig } from 'vite';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';

// The workspace packages resolve to their sources, so the demo runs without
// building them first. The Pages build serves it from a subpath with
// `vite build --base /overlapmark/` (see .github/workflows/pages.yml); every
// other build keeps the default base.
export default defineConfig({
    resolve: { alias: workspaceAliases },
});
