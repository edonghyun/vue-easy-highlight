// The type errors of a package's type-test fixture, the counterpart of a
// consumer's `tsc` run. The adapters' type tests (test/types/) are checked
// with it from node tests: Vitest's typecheck mode warns on every run that it
// is experimental.
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * The type errors of `fixture`, a file in `<packageRoot>/test/types/`,
 * checked with the package's own tsconfig, each as `<file>: <message>` with
 * `<file>` relative to the package. `source`, when given, is checked in the
 * fixture's place, so a deliberately wrong fixture need not exist on disk.
 */
export function typeErrorsIn(
    packageRoot: string,
    fixture: string,
    source?: string,
): string[] {
    const config = ts.getParsedCommandLineOfConfigFile(
        join(packageRoot, 'tsconfig.json'),
        {},
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    )!;
    // core's sources stand in for its declarations, and read
    // `process.env.NODE_ENV`.
    const options = { ...config.options, types: ['node'] };
    const file = join(packageRoot, 'test/types', fixture);
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
                `${d.file ? relative(packageRoot, d.file.fileName) : '?'}: ` +
                ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        );
}
