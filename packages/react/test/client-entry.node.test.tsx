import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let outDir = '';

beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'overlapmark-react-'));
    await build({
        config: new URL('../tsup.config.ts', import.meta.url).pathname,
        outDir,
        dts: false,
        silent: true,
    });
}, 60_000);

afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
});

describe('@overlapmark/react built entry', () => {
    it('marks the React entry as a client module', () => {
        const source = readFileSync(join(outDir, 'index.js'), 'utf8');

        expect(source.trimStart()).toMatch(/^(['"])use client\1;/);
    });
});
