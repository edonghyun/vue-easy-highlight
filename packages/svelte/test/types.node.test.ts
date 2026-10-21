// The type tests in test/types/, checked by svelte-check with the package's
// own options, as a consumer's components are. Vitest's typecheck mode runs
// only `tsc` or `vue-tsc`, which read no Svelte markup.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const svelteCheck = join(
    dirname(require.resolve('svelte-check/package.json')),
    'bin/svelte-check',
);

const misusedProp = `
<script lang="ts">
    import { Highlighter } from '${join(root, 'src/lib')}';
</script>

<Highlighter text={42} />
`;

// Each check type-checks a whole program, Svelte's types included: seconds each.
const typeCheckTimeout = 30_000;

let out: string;

/**
 * The type errors and warnings svelte-check reports in `files`, each as
 * `<file>: <message>` with `<file>` relative to the package.
 */
function typeErrorsOf(files: string[]): string[] {
    const tsconfig = join(out, 'tsconfig.json');
    writeFileSync(
        tsconfig,
        JSON.stringify({
            extends: join(root, 'tsconfig.json'),
            compilerOptions: {
                // core's sources stand in for its declarations, and read
                // `process.env.NODE_ENV`.
                types: ['node'],
                typeRoots: [
                    dirname(
                        dirname(require.resolve('@types/node/package.json')),
                    ),
                ],
            },
            include: files,
        }),
    );
    const { stdout } = spawnSync(
        process.execPath,
        [
            svelteCheck,
            '--workspace',
            out,
            '--tsconfig',
            tsconfig,
            '--output',
            'machine',
        ],
        { encoding: 'utf8' },
    );
    return [
        ...stdout.matchAll(/^\d+ (?:ERROR|WARNING) "(.+?)" \d+:\d+ "(.*)"$/gm),
    ].map(
        ([, file, message]) =>
            `${relative(root, resolve(out, file))}: ${message}`,
    );
}

beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'overlapmark-svelte-types-'));
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('Highlighter types', () => {
    it(
        'type highlight data in event details, the decoration snippet and describe from the highlights',
        () => {
            const errors = typeErrorsOf([
                join(root, 'test/types/TypedData.svelte'),
            ]);

            expect(errors).toEqual([]);
        },
        typeCheckTimeout,
    );

    it(
        'reject a prop of the wrong type where it is passed',
        () => {
            const misuse = join(out, 'MisusedProp.svelte');
            writeFileSync(misuse, misusedProp);

            const errors = typeErrorsOf([misuse]);

            expect(errors).toContainEqual(
                expect.stringMatching(/MisusedProp\.svelte: /),
            );
        },
        typeCheckTimeout,
    );
});
