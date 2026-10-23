// Vite/Vitest aliases resolving every workspace package to its sources, the
// counterpart of tsconfig.workspace-paths.json. Tests and the site run
// without building first, and every importer shares one module instance:
// @overlapmark/adapter-contract imports @overlapmark/core without declaring
// it (core's own tests run the suite, so a declared dependency would be a
// cycle), and it must resolve to the same core sources as the package under
// test. A new package adds its entry points here.
import { fileURLToPath } from 'node:url';

export interface WorkspaceAlias {
    find: RegExp;
    replacement: string;
}

const source = (path: string): string =>
    fileURLToPath(new URL(`./packages/${path}`, import.meta.url));

export const workspaceAliases: WorkspaceAlias[] = [
    {
        find: /^@overlapmark\/core\/styles\.css$/,
        replacement: source('core/src/styles.css'),
    },
    {
        find: /^@overlapmark\/core\/adapter$/,
        replacement: source('core/src/adapter.ts'),
    },
    {
        find: /^@overlapmark\/core\/dom$/,
        replacement: source('core/src/dom/index.ts'),
    },
    { find: /^@overlapmark\/core$/, replacement: source('core/src/index.ts') },
    { find: /^@overlapmark\/dom$/, replacement: source('dom/src/index.ts') },
    { find: /^@overlapmark\/vue$/, replacement: source('vue/src/index.ts') },
    {
        find: /^@overlapmark\/react$/,
        replacement: source('react/src/index.ts'),
    },
    {
        find: /^@overlapmark\/svelte$/,
        replacement: source('svelte/src/lib/index.ts'),
    },
    {
        find: /^@overlapmark\/adapter-contract\/fixtures$/,
        replacement: source('adapter-contract/src/fixtures.ts'),
    },
    {
        find: /^@overlapmark\/adapter-contract$/,
        replacement: source('adapter-contract/src/index.ts'),
    },
];
