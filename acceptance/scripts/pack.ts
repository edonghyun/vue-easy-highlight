import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tarballs = join(root, 'acceptance/.work/tarballs');

interface Manifest {
    name: string;
    private?: boolean;
}

/**
 * Builds every package and packs each published one into
 * `acceptance/.work/tarballs`. Returns package name -> absolute .tgz path.
 */
export async function pack(): Promise<Record<string, string>> {
    await run('pnpm', ['-r', '--filter', './packages/*', 'build'], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
    });
    await rm(tarballs, { recursive: true, force: true });
    await mkdir(tarballs, { recursive: true });

    const result: Record<string, string> = {};
    const dirs = await readdir(join(root, 'packages'));
    for (const dir of dirs.sort()) {
        const cwd = join(root, 'packages', dir);
        const manifest: Manifest = JSON.parse(
            await readFile(join(cwd, 'package.json'), 'utf8'),
        );
        if (manifest.private) continue;
        const before = new Set(await readdir(tarballs));
        await run('pnpm', ['pack', '--pack-destination', tarballs], { cwd });
        const added = (await readdir(tarballs)).filter((f) => !before.has(f));
        if (added.length !== 1) {
            throw new Error(
                `expected one tarball for ${manifest.name}, got ${added.join(', ') || 'none'}`,
            );
        }
        result[manifest.name] = join(tarballs, added[0]);
    }
    return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(JSON.stringify(await pack(), null, 4));
}
