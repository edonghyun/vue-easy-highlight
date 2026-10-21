import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', 'dom/index': 'src/dom/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    onSuccess: async () => {
        mkdirSync('dist', { recursive: true });
        copyFileSync('src/styles.css', 'dist/styles.css');
    },
});
