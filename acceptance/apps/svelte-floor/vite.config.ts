import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { overlapmarkProvenance } from '../../scripts/provenance-plugin.ts';

// Svelte 5.0's newest toolchain is Vite 7 (vite-plugin-svelte 7 needs
// Svelte 5.46), which bundles with Rollup: `rollupOptions`, not
// `rolldownOptions`. The floor is client-only, so no SSR build.
export default defineConfig({
    plugins: [svelte(), overlapmarkProvenance(__dirname)],
    build: {
        rollupOptions: {
            input: { index: 'index.html', harness: 'harness.html' },
        },
    },
});
