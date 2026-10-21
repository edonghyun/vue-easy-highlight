import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { overlapmarkProvenance } from '../../scripts/provenance-plugin.ts';

export default defineConfig({
    plugins: [svelte(), overlapmarkProvenance(__dirname)],
    build: {
        rolldownOptions: {
            input: {
                index: 'index.html',
                harness: 'harness.html',
            },
        },
    },
});
