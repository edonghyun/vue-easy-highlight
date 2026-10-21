import { spawnSync } from 'node:child_process';
import { pack } from './pack.ts';

// The adapters ship ESM only; core and dom ship ESM and CJS.
const esmOnly = new Set([
    '@overlapmark/vue',
    '@overlapmark/react',
    '@overlapmark/svelte',
]);

// styles.css is a stylesheet, not a JS or TypeScript entry point, so attw can
// never resolve types for it.
function attwExtra(name: string): string[] {
    return name === '@overlapmark/core'
        ? ['--exclude-entrypoints', './styles.css']
        : [];
}

function check(command: string, args: string[]): string | null {
    const { status, stdout, stderr } = spawnSync(
        'pnpm',
        ['exec', command, ...args],
        { encoding: 'utf8' },
    );
    return status === 0 ? null : `${stdout}${stderr}`.trim();
}

const tarballs = await pack();
let failed = false;
for (const [name, tgz] of Object.entries(tarballs)) {
    const profile = esmOnly.has(name) ? 'esm-only' : 'node16';
    const problems = [
        check('publint', [tgz, '--strict']),
        check('attw', [tgz, '--profile', profile, ...attwExtra(name)]),
    ].filter((p) => p !== null);
    if (problems.length === 0) {
        console.log(`OK    ${name}`);
    } else {
        failed = true;
        console.log(`FAIL  ${name}\n${problems.join('\n\n')}\n`);
    }
}
process.exit(failed ? 1 : 0);
