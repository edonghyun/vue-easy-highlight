import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

/**
 * Evaluates src/warn.ts the way a browser bundle sees it: optionally with
 * `process.env.NODE_ENV` statically replaced (as bundlers do), and with no
 * `process` global at all.
 */
function loadAsBundled(nodeEnv: string | null) {
    let src = readFileSync(new URL('../src/warn.ts', import.meta.url), 'utf8');
    if (nodeEnv !== null)
        src = src.replaceAll('process.env.NODE_ENV', JSON.stringify(nodeEnv));
    const js = ts.transpileModule(src, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
    }).outputText;
    const exports: { warnOnce?: (m: string) => void } = {};
    const fakeConsole = { warn: vi.fn() };
    // `process` is shadowed by an undefined parameter: there is no process in a browser.
    new Function('exports', 'process', 'console', js)(
        exports,
        undefined,
        fakeConsole,
    );
    return { warnOnce: exports.warnOnce!, warn: fakeConsole.warn };
}

describe('warnOnce dev guard', () => {
    it('warns in a browser bundle built for development (no process global)', () => {
        const { warnOnce, warn } = loadAsBundled('development');
        warnOnce('x');
        warnOnce('x');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('[overlapmark] x');
    });

    it('is silent in a production bundle', () => {
        const { warnOnce, warn } = loadAsBundled('production');
        warnOnce('x');
        expect(warn).not.toHaveBeenCalled();
    });

    it('is silent and does not throw without process and without replacement', () => {
        const { warnOnce, warn } = loadAsBundled(null);
        expect(() => warnOnce('x')).not.toThrow();
        expect(warn).not.toHaveBeenCalled();
    });
});
