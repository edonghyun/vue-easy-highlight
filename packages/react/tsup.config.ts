import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    // esbuild drops module directives while bundling; a Server Components
    // framework needs this one on the entry to treat it as client code.
    banner: { js: "'use client';" },
    external: [
        'react',
        'react/jsx-runtime',
        '@overlapmark/core',
        '@overlapmark/core/adapter',
        '@overlapmark/core/dom',
    ],
});
