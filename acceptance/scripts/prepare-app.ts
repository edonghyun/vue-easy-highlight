import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pack } from './pack.ts';
import { builtAppsFile } from './serve.ts';

const run = promisify(execFile);

const acceptance = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(acceptance, '.work');

export type App = 'vanilla' | 'vue' | 'react' | 'svelte';
export type Variant = 'client' | 'ssr' | 'floor';

interface Manifest {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
}

async function npm(cwd: string, args: string[]): Promise<void> {
    try {
        await run('npm', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
        const { stdout = '', stderr = '' } = error as {
            stdout?: string;
            stderr?: string;
        };
        throw new Error(
            `npm ${args.join(' ')} failed in ${cwd}\n${stdout}${stderr}`,
            { cause: error },
        );
    }
}

/** For each CommonJS entry point: an export it must provide as a function. */
const commonJsEntries: Record<string, string> = {
    '@overlapmark/core': 'computeSegments',
    '@overlapmark/core/adapter': 'segmentElements',
    '@overlapmark/core/dom': 'attachInteractions',
    '@overlapmark/dom': 'createHighlighter',
};

/**
 * Loads every CommonJS entry point with `require` from an app installed from
 * the tarballs (the browser builds load only the ESM ones), and fails when
 * one does not load or lacks its export.
 */
async function checkCommonJs(cwd: string): Promise<void> {
    // `node -e` passes its first extra argument as `process.argv[1]`.
    const script = `
        const entries = JSON.parse(process.argv[1]);
        for (const [id, name] of Object.entries(entries)) {
            if (typeof require(id)[name] !== 'function')
                throw new Error(\`require('\${id}').\${name} is not a function\`);
        }`;
    try {
        await run(
            'node',
            [
                '--input-type=commonjs',
                '-e',
                script,
                JSON.stringify(commonJsEntries),
            ],
            { cwd },
        );
    } catch (error) {
        const { stderr = '' } = error as { stderr?: string };
        throw new Error(
            `the CommonJS entry points do not load from the tarballs in ${cwd}\n${stderr}`,
            { cause: error },
        );
    }
}

/**
 * Copies `acceptance/apps/<app>` (for `floor`, with `apps/<app>-floor` laid
 * over it) to `acceptance/.work/apps/<app>-<variant>`, points every
 * `@overlapmark/*` dependency at its tarball, installs with npm and builds.
 * Returns the dist dir to serve.
 */
export async function prepareApp(
    app: App,
    variant: Variant,
    tarballs: Record<string, string>,
): Promise<string> {
    const dest = join(work, 'apps', `${app}-${variant}`);
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    const sources = [join(acceptance, 'apps', app)];
    if (variant === 'floor')
        sources.push(join(acceptance, 'apps', `${app}-floor`));
    for (const source of sources) {
        await cp(source, dest, {
            recursive: true,
            filter: (path) =>
                !['node_modules', 'dist', 'dist-ssr', 'dist-server'].includes(
                    basename(path),
                ),
        });
    }
    // The apps import the shared fixtures (`../../../fixtures.json` from
    // src/), the provenance plugin and SSR build (`../../scripts/`) and the
    // SSR hydration watch (`../../../scripts/` from src/) by relative path.
    // `.work/apps/<name>` is as deep as `apps/<app>`, so copies at the same
    // places under `.work/` keep those paths valid in the work dir.
    await mkdir(join(work, 'scripts'), { recursive: true });
    await cp(join(acceptance, 'fixtures.json'), join(work, 'fixtures.json'));
    for (const script of [
        'provenance-plugin.ts',
        'ssr-build.ts',
        'hydration.ts',
    ]) {
        await cp(
            join(acceptance, 'scripts', script),
            join(work, 'scripts', script),
        );
    }

    const manifestPath = join(dest, 'package.json');
    const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const deps of [manifest.dependencies, manifest.devDependencies]) {
        for (const name of Object.keys(deps ?? {})) {
            if (!name.startsWith('@overlapmark/')) continue;
            if (!tarballs[name]) throw new Error(`no tarball for ${name}`);
            deps![name] = `file:${tarballs[name]}`;
        }
    }
    // Transitive @overlapmark dependencies (dom -> core) take the same
    // tarballs, never a registry copy.
    manifest.overrides = {
        ...manifest.overrides,
        ...Object.fromEntries(
            Object.entries(tarballs).map(([name, tgz]) => [
                name,
                `file:${tgz}`,
            ]),
        ),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

    await npm(dest, ['install', '--no-audit', '--no-fund']);
    if (app === 'vanilla' && variant === 'client') await checkCommonJs(dest);
    await npm(dest, ['run', 'build']);
    if (variant === 'ssr') {
        await npm(dest, ['run', 'build:ssr']);
        return join(dest, 'dist-ssr');
    }
    return join(dest, 'dist');
}

/** Every `[app, variant]` the sources under `acceptance/apps` provide. */
async function presentTargets(): Promise<[App, Variant][]> {
    const dirs = (
        await readdir(join(acceptance, 'apps'), { withFileTypes: true })
    )
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    const targets: [App, Variant][] = [];
    for (const dir of dirs.sort()) {
        if (dir.endsWith('-floor')) continue;
        const app = dir as App;
        const manifest: Manifest = JSON.parse(
            await readFile(
                join(acceptance, 'apps', dir, 'package.json'),
                'utf8',
            ),
        );
        targets.push([app, 'client']);
        if (manifest.scripts?.['build:ssr']) targets.push([app, 'ssr']);
        if (existsSync(join(acceptance, 'apps', `${dir}-floor`)))
            targets.push([app, 'floor']);
    }
    return targets;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // ACCEPTANCE_APPS: comma-separated `<app>` or `<app>-<variant>` names.
    const wanted = process.env.ACCEPTANCE_APPS?.split(',').map((s) => s.trim());
    const targets = (await presentTargets()).filter(
        ([app, variant]) =>
            !wanted ||
            wanted.includes(app) ||
            wanted.includes(`${app}-${variant}`),
    );
    if (targets.length === 0)
        throw new Error(`no app matches ACCEPTANCE_APPS=${wanted}`);

    const tarballs = await pack();
    const built: Record<string, string> = {};
    for (const [app, variant] of targets) {
        console.log(`building ${app}-${variant}`);
        built[`${app}-${variant}`] = await prepareApp(app, variant, tarballs);
    }
    await writeFile(builtAppsFile, `${JSON.stringify(built, null, 4)}\n`);
    console.log(`built ${Object.keys(built).join(', ')}`);
}
