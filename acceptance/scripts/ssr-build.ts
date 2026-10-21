import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BuildOptions, Plugin } from 'vite';

// A framework app's `build:ssr` (the `ssr` variant):
//
//   vite build --mode ssr                            -> dist-ssr/harness.html
//   vite build --mode ssr --ssr src/entry-server.*   -> dist-server/entry-server.js
//   node ssr-build.ts                                -> the server's markup in #host
//
// The app's `.env.ssr` sets NODE_ENV=development, so the frameworks keep the
// hydration mismatch warnings their production builds leave out.

/** Points harness.html's script at the entry that hydrates instead of mounting. */
export function hydratingEntry(from: string, to: string): Plugin {
    return {
        name: 'harness-hydrating-entry',
        transformIndexHtml: {
            order: 'pre',
            handler(html) {
                if (!html.includes(`src="${from}"`))
                    throw new Error(`harness.html has no script ${from}`);
                return html.replace(`src="${from}"`, `src="${to}"`);
            },
        },
    };
}

/** The `--mode ssr` build options: the server bundle, or the hydrating harness page. */
export function ssrBuild(isSsrBuild: boolean | undefined): BuildOptions {
    return isSsrBuild
        ? { outDir: 'dist-server' }
        : {
              outDir: 'dist-ssr',
              rolldownOptions: { input: { harness: 'harness.html' } },
          };
}

/**
 * Writes the server render (`render()` of `dist-server/entry-server.js`)
 * into the `#host` of `dist-ssr/harness.html`, so the page is the server's
 * markup until its script hydrates it.
 */
export async function prerender(app: string): Promise<void> {
    const server = pathToFileURL(join(app, 'dist-server/entry-server.js'));
    const { render } = (await import(server.href)) as {
        render(): string | Promise<string>;
    };
    const page = join(app, 'dist-ssr/harness.html');
    const html = await readFile(page, 'utf8');
    const host = '<div id="host"></div>';
    if (!html.includes(host)) throw new Error(`${page} has no empty ${host}`);
    const markup = await render();
    await writeFile(
        page,
        html.replace(host, () => `<div id="host">${markup}</div>`),
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await prerender(process.cwd());
}
