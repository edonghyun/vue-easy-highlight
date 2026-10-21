import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const acceptance = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where `acceptance:build` records the dist dir of every app it built. */
export const builtAppsFile = join(acceptance, '.work/apps.json');

/** `<app>-<variant>` -> absolute dist dir, as the last build left them. */
export function builtApps(): Record<string, string> {
    try {
        return JSON.parse(readFileSync(builtAppsFile, 'utf8'));
    } catch {
        return {};
    }
}

const basePort = Number(process.env.ACCEPTANCE_PORT ?? 4310);

/** The port `serve(dirs)` gives `app`: one per app, in name order. */
export function portOf(dirs: Record<string, string>, app: string): number {
    const index = Object.keys(dirs).sort().indexOf(app);
    if (index < 0) throw new Error(`no built app named ${app}`);
    return basePort + index;
}

const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
};

function staticServer(dir: string): Server {
    return createServer(async (req, res) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost');
        const file = join(
            dir,
            decodeURIComponent(pathname === '/' ? '/index.html' : pathname),
        );
        try {
            if (!file.startsWith(dir + sep) || !(await stat(file)).isFile())
                throw new Error('not found');
            const body = await readFile(file);
            res.writeHead(200, {
                'content-type':
                    types[extname(file)] ?? 'application/octet-stream',
                'cache-control': 'no-store',
            });
            res.end(body);
        } catch {
            res.writeHead(404).end();
        }
    });
}

/**
 * Serves each dist dir on its own port (see `portOf`). `listening` settles
 * once every server accepts connections.
 */
export function serve(dirs: Record<string, string>): {
    port(app: string): number;
    listening: Promise<void>;
} {
    const port = (app: string): number => portOf(dirs, app);
    const listening = Promise.all(
        Object.entries(dirs).map(
            ([app, dir]) =>
                new Promise<void>((done, fail) => {
                    const server = staticServer(resolve(dir));
                    server.once('error', fail);
                    server.listen(port(app), '127.0.0.1', done);
                }),
        ),
    ).then(() => undefined);
    return { port, listening };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const dirs = builtApps();
    if (Object.keys(dirs).length === 0) {
        console.error('No built apps: run `pnpm acceptance:build` first.');
        process.exit(1);
    }
    const server = serve(dirs);
    await server.listening;
    for (const app of Object.keys(dirs).sort())
        console.log(`${app}: http://127.0.0.1:${server.port(app)}`);
    console.log('acceptance apps listening');
}
