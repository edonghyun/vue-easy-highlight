import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { overlapmarkProvenance } from '../../scripts/provenance-plugin.ts';
import { hydratingEntry, ssrBuild } from '../../scripts/ssr-build.ts';

// `--mode ssr` is the `ssr` variant's build (see scripts/ssr-build.ts).
export default defineConfig(({ mode, isSsrBuild }) => ({
    plugins: [
        react(),
        overlapmarkProvenance(__dirname),
        mode === 'ssr' &&
            hydratingEntry('/src/harness.tsx', '/src/entry-client-ssr.tsx'),
    ],
    // Bundled into the server build too, so provenance covers it.
    ssr: { noExternal: [/^@overlapmark\//] },
    build:
        mode === 'ssr'
            ? ssrBuild(isSsrBuild)
            : {
                  rolldownOptions: {
                      input: {
                          index: 'index.html',
                          harness: 'harness.html',
                      },
                  },
              },
}));
