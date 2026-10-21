import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { overlapmarkProvenance } from '../../scripts/provenance-plugin.ts';

export default defineConfig({
    plugins: [vue(), overlapmarkProvenance(__dirname)],
    build: {
        rolldownOptions: {
            input: {
                index: 'index.html',
                harness: 'harness.html',
            },
        },
    },
});
