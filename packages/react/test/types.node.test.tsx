// The type tests in test/types/, checked by the TypeScript compiler with the
// package's own options, as a consumer's code is. The compiler API rather
// than Vitest's typecheck mode, which warns on every run that it is
// experimental; the Vue and Svelte adapters check their type tests the same way.
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const misusedProp = `
    import { Highlighter } from '../../src';

    <Highlighter text={42} />;
`;

// Each check type-checks a whole program, React's types included: seconds each.
const typeCheckTimeout = 30_000;

/**
 * The type errors of `fixture`, a file in test/types/, each as
 * `<file>: <message>`. `source`, when given, is checked in its place.
 */
function typeErrorsOf(fixture: string, source?: string): string[] {
    const config = ts.getParsedCommandLineOfConfigFile(
        join(root, 'tsconfig.json'),
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    )!;
    // core's sources stand in for its declarations, and read
    // `process.env.NODE_ENV`.
    const options = { ...config.options, types: ['node'] };
    const file = join(root, 'test/types', fixture);
    const host = ts.createCompilerHost(options);
    if (source !== undefined) {
        const { fileExists, getSourceFile } = host;
        host.fileExists = (name) => name === file || fileExists(name);
        host.getSourceFile = (name, ...rest) =>
            name === file
                ? ts.createSourceFile(name, source, ts.ScriptTarget.ES2022)
                : getSourceFile(name, ...rest);
    }
    const program = ts.createProgram([file], options, host);
    return ts
        .getPreEmitDiagnostics(program)
        .map(
            (d) =>
                `${d.file ? relative(root, d.file.fileName) : '?'}: ` +
                ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        );
}

describe('Highlighter types', () => {
    it(
        'type highlight data in event details, the decoration and describe from the highlights',
        () => {
            const errors = typeErrorsOf('typed-data.tsx');

            expect(errors).toEqual([]);
        },
        typeCheckTimeout,
    );

    it(
        'reject a prop of the wrong type where it is passed',
        () => {
            const errors = typeErrorsOf('misused-prop.tsx', misusedProp);

            expect(errors).toContainEqual(
                expect.stringMatching(/^test\/types\/misused-prop\.tsx: /),
            );
        },
        typeCheckTimeout,
    );
});
