import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (p: string): string =>
    fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Alias the workspace packages to their sources so the playground runs
// without building them first.
export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@overlapmark/core/styles.css',
                replacement: src('core/src/styles.css'),
            },
            {
                find: '@overlapmark/core/dom',
                replacement: src('core/src/dom/index.ts'),
            },
            {
                find: '@overlapmark/core',
                replacement: src('core/src/index.ts'),
            },
            { find: '@overlapmark/dom', replacement: src('dom/src/index.ts') },
        ],
    },
});
