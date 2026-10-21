import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    external: ['vue', '@overlapmark/core', '@overlapmark/core/dom'],
});
