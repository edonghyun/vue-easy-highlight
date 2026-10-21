import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'adapter/index': 'src/adapter.ts',
        'dom/index': 'src/dom/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    // Keep splitting on for CJS too: the dom/ and adapter/ entries share chunks with the main entry instead of bundling their own copies.
    splitting: true,
    clean: true,
    onSuccess: async () => {
        mkdirSync('dist', { recursive: true });
        copyFileSync('src/styles.css', 'dist/styles.css');
    },
});
