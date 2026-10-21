import { defineConfig } from 'vite';
import { workspaceAliases } from '../../vitest.workspace-aliases.ts';

// The workspace packages resolve to their sources, so the playground runs
// without building them first.
export default defineConfig({
    resolve: { alias: workspaceAliases },
});
