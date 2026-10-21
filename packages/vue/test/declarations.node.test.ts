// The declarations a consumer type-checks against are emitted from the
// sources with the Vue the package builds with (3.5), but must hold on every
// Vue the peer range admits, down to 3.3. This emits them as the build does
// and checks a consumer of them against the types of Vue 3.3, 3.4, 3.5.0 and
// the current Vue.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** The directory of an installed package, for a `paths` entry. */
const packageDir = (name: string): string =>
    dirname(require.resolve(`${name}/package.json`));

const vueTypes = {
    // From 3.3 on, `vue`'s types are `export * from '@vue/runtime-dom'`.
    '3.3': packageDir('vue-3.3-runtime-dom'),
    '3.4': packageDir('vue-3.4-runtime-dom'),
    '3.5.0': packageDir('vue-3.5.0-runtime-dom'),
    current: packageDir('vue'),
};

const correctUse = `
    import { h } from 'vue';
    import type { Segment } from '@overlapmark/core';
    import { Highlighter } from './index';

    export const vnode = h(
        Highlighter,
        {
            text: 'Overlapping highlights',
            highlights: [{ id: 'a', start: 0, end: 11 }],
            strategy: 'layers',
            onSelect: (detail) => detail.start + detail.end,
        },
        { decoration: ({ segment }: { segment: Segment }) => segment.text },
    );
`;

// The component as a template type checker (vue-tsc) sees it: constructed
// from the props it is given. A render function names the data's type, as
// `h(Highlighter<Note>, ...)`. `Equal` holds for identical types only, so
// `any` and `unknown` pass none of the checks.
const typedData = `
    import { h } from 'vue';
    import type { Highlight, Segment } from '@overlapmark/core';
    import { Highlighter } from './index';

    type Equal<A, B> =
        (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
            ? true
            : false;
    interface Note {
        note: string;
    }
    const notes: Highlight<Note>[] = [
        { id: 'a', start: 0, end: 11, data: { note: 'first' } },
    ];

    const highlighter = new Highlighter({
        text: 'Overlapping highlights',
        highlights: notes,
        describe: (highlights) => {
            const typed: Equal<(typeof highlights)[0]['data'], Note | undefined> = true;
            // @ts-expect-error \`Note\` has no \`missing\`.
            return typed && highlights[0]!.data?.missing;
        },
        onSelect: (detail) => {
            const typed: Equal<(typeof detail.highlights)[0]['data'], Note | undefined> = true;
            // @ts-expect-error \`Note\` has no \`missing\`.
            return typed && detail.highlights[0]!.data?.missing;
        },
        onHover: (detail) => {
            const typed: Equal<typeof detail.segment, Segment<Note>> = true;
            return typed;
        },
    });

    type DecorationProps = Parameters<
        NonNullable<typeof highlighter.$slots.decoration>
    >[0];
    export const typedSegment: Equal<DecorationProps['segment'], Segment<Note>> = true;
    export const missingField = (props: DecorationProps) =>
        // @ts-expect-error \`Note\` has no \`missing\`.
        props.segment.highlights[0]!.data?.missing;

    export const vnode = h(Highlighter<Note>, {
        text: 'Overlapping highlights',
        highlights: notes,
        onClick: (detail) => {
            const typed: Equal<(typeof detail.highlights)[0]['data'], Note | undefined> = true;
            // @ts-expect-error \`Note\` has no \`missing\`.
            return typed && detail.highlights[0]!.data?.missing;
        },
    });
`;

const misusedProp = `
    import { h } from 'vue';
    import { Highlighter } from './index';

    export const vnode = h(Highlighter, { text: 42 });
`;

// Each check type-checks a whole program, Vue's types included: seconds each.
const typeCheckTimeout = 30_000;

let out: string;

/** Emits the package's declarations into `out`, as its build does. */
function givenEmittedDeclarations(): void {
    const config = ts.getParsedCommandLineOfConfigFile(
        join(root, 'tsconfig.json'),
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    )!;
    const program = ts.createProgram([join(root, 'src/index.ts')], {
        ...config.options,
        noEmit: false,
        declaration: true,
        emitDeclarationOnly: true,
    });
    const src = join(root, 'src');
    program.emit(undefined, (fileName, text) => {
        const relativePath = relative(src, fileName);
        if (relativePath.startsWith('..')) return;
        writeFileSync(join(out, relativePath), text);
    });
}

/**
 * The type errors of `source`, a module next to the declarations, against
 * `vue`, each as `<file>: <message>`.
 */
function typeErrorsOf(source: string, vue: string): string[] {
    const consumer = join(out, 'consumer.ts');
    writeFileSync(consumer, source);
    const workspace = resolve(root, '../..');
    const program = ts.createProgram([consumer], {
        strict: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        // core's sources stand in for its declarations, and read
        // `process.env.NODE_ENV`.
        types: ['node'],
        // The declarations are library files: checking them is the point.
        skipLibCheck: false,
        noEmit: true,
        paths: {
            vue: [vue],
            '@overlapmark/core': [
                join(workspace, 'packages/core/src/index.ts'),
            ],
            '@overlapmark/core/adapter': [
                join(workspace, 'packages/core/src/adapter.ts'),
            ],
            '@overlapmark/core/dom': [
                join(workspace, 'packages/core/src/dom/index.ts'),
            ],
        },
    });
    return ts
        .getPreEmitDiagnostics(program)
        .map(
            (d) =>
                `${d.file ? relative(out, d.file.fileName) : '?'}: ` +
                ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        );
}

beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'overlapmark-vue-dts-'));
    givenEmittedDeclarations();
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe.each(Object.entries(vueTypes))(
    'The emitted declarations checked against Vue %s types',
    (_, vue) => {
        it(
            'accept props, listeners and the decoration slot',
            () => {
                const errors = typeErrorsOf(correctUse, vue);

                expect(errors).toEqual([]);
            },
            typeCheckTimeout,
        );

        it(
            'type highlight data in listeners, describe and the decoration slot from the highlights',
            () => {
                const errors = typeErrorsOf(typedData, vue);

                expect(errors).toEqual([]);
            },
            typeCheckTimeout,
        );

        it(
            'reject a prop of the wrong type where it is passed',
            () => {
                const errors = typeErrorsOf(misusedProp, vue);

                expect(errors).toContainEqual(
                    expect.stringMatching(/^consumer\.ts: /),
                );
            },
            typeCheckTimeout,
        );
    },
);
