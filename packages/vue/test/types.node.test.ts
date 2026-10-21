// The template type test in test/types/, checked by vue-tsc with the
// package's own options, as a consumer's components are: vue-tsc infers the
// highlights' data type the way a template is checked, which plain `tsc`
// cannot show. The emitted declarations on every Vue are
// declarations.node.test.ts's subject.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const packageDir = (name: string): string =>
    dirname(require.resolve(`${name}/package.json`));

const vueTsc = join(packageDir('vue-tsc'), 'bin/vue-tsc.js');

const misusedProp = `
<script setup lang="ts">
import { Highlighter } from '${join(root, 'src')}';
</script>

<template>
    <Highlighter :text="42" />
</template>
`;

// Each check type-checks a whole program, Vue's types included: seconds each.
const typeCheckTimeout = 30_000;

let out: string;

/**
 * The workspace's `paths`, absolute, and `vue`, which a component outside the
 * package would not find.
 */
function pathsOutsideThePackage(): Record<string, string[]> {
    const workspace = resolve(root, '../..');
    const { config } = ts.readConfigFile(
        join(workspace, 'tsconfig.workspace-paths.json'),
        ts.sys.readFile,
    );
    const paths: Record<string, string[]> = { vue: [packageDir('vue')] };
    for (const [name, targets] of Object.entries<string[]>(
        config.compilerOptions.paths,
    ))
        paths[name] = targets.map((target) => resolve(workspace, target));
    return paths;
}

/**
 * The type errors vue-tsc reports in `files`, each as `<file>: <message>`
 * with `<file>` relative to the package; a failed run adds its exit status
 * and anything it wrote to stderr.
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
                typeRoots: [dirname(packageDir('@types/node'))],
                paths: pathsOutsideThePackage(),
            },
            include: files,
        }),
    );
    const { status, stdout, stderr } = spawnSync(
        process.execPath,
        [vueTsc, '--noEmit', '--pretty', 'false', '-p', tsconfig],
        // It names files relative to the working directory.
        { cwd: root, encoding: 'utf8' },
    );
    const errors = [
        ...stdout.matchAll(/^(.+?)\(\d+,\d+\): error TS\d+: (.*)$/gm),
    ].map(
        ([, file, message]) =>
            `${relative(root, resolve(root, file))}: ${message}`,
    );
    if (status !== 0) errors.push(`vue-tsc exited with ${status}`);
    if (stderr) errors.push(`vue-tsc stderr: ${stderr}`);
    return errors;
}

beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'overlapmark-vue-types-'));
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('Highlighter in a template', () => {
    it(
        'types highlight data in listeners, describe and the decoration slot from the highlights',
        () => {
            const errors = typeErrorsOf([
                join(root, 'test/types/TypedData.vue'),
            ]);

            expect(errors).toEqual([]);
        },
        typeCheckTimeout,
    );

    it(
        'rejects a prop of the wrong type where it is passed',
        () => {
            const misuse = join(out, 'MisusedProp.vue');
            writeFileSync(misuse, misusedProp);

            const errors = typeErrorsOf([misuse]);

            expect(errors).toContainEqual(
                expect.stringMatching(/MisusedProp\.vue: /),
            );
        },
        typeCheckTimeout,
    );
});
