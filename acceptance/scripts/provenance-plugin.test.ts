import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { overlapmarkProvenance } from './provenance-plugin.ts';

const appRoot = '/work/apps/vanilla-client';
const installed = (file: string): string =>
    join(appRoot, 'node_modules/@overlapmark', file);

type Hook = (this: unknown, ...args: unknown[]) => unknown;

interface Build {
    /** Import specifier -> the id Vite resolved it to. */
    resolved?: Record<string, string>;
    /** Ids Vite loaded. */
    loaded?: string[];
    /** `resolve.alias` of the app's Vite config. */
    alias?: { find: string | RegExp; replacement: string }[];
}

/** Runs the plugin's hooks over a build, and returns its buildEnd. */
async function givenBuild({
    resolved = {},
    loaded = [],
    alias = [],
}: Build): Promise<() => unknown> {
    const plugin = overlapmarkProvenance(appRoot);
    (plugin.configResolved as Hook).call({}, { resolve: { alias } });
    const context = {
        resolve: async (source: string) =>
            source in resolved ? { id: resolved[source] } : null,
    };
    for (const source of Object.keys(resolved))
        await (plugin.resolveId as Hook).call(
            context,
            source,
            join(appRoot, 'src/main.ts'),
            {},
        );
    for (const id of loaded) (plugin.load as Hook).call({}, id);
    return () => (plugin.buildEnd as Hook).call({});
}

describe('The provenance plugin', () => {
    it('fails the build when an @overlapmark import resolves into packages/', async () => {
        const buildEnd = await givenBuild({
            resolved: {
                '@overlapmark/core': installed('core/dist/index.js'),
                '@overlapmark/dom': '/repo/packages/dom/dist/index.js',
            },
        });

        expect(buildEnd).toThrow('/repo/packages/dom/dist/index.js');
    });

    it('fails the build when an @overlapmark file loads from outside the app node_modules', async () => {
        const outside = '/repo/node_modules/@overlapmark/core/dist/index.js';
        const buildEnd = await givenBuild({
            resolved: { '@overlapmark/dom': installed('dom/dist/index.js') },
            loaded: [installed('dom/dist/index.js'), outside],
        });

        expect(buildEnd).toThrow(outside);
    });

    it('fails the build when an alias redirects an @overlapmark import', async () => {
        const buildEnd = await givenBuild({
            resolved: { '@overlapmark/dom': installed('dom/dist/index.js') },
            alias: [
                {
                    find: /^@overlapmark\/core$/,
                    replacement: '/repo/packages/core/src/index.ts',
                },
            ],
        });

        expect(buildEnd).toThrow('/repo/packages/core/src/index.ts');
    });

    it('fails the build when no @overlapmark import was resolved', async () => {
        const buildEnd = await givenBuild({
            loaded: [join(appRoot, 'src/main.ts')],
        });

        expect(buildEnd).toThrow('no @overlapmark import');
    });

    it('passes when every @overlapmark import resolves under the app node_modules', async () => {
        const buildEnd = await givenBuild({
            resolved: {
                '@overlapmark/core/styles.css': installed(
                    'core/dist/styles.css',
                ),
                '@overlapmark/dom': installed('dom/dist/index.js'),
                '@overlapmark/core': installed('core/dist/index.js'),
            },
            loaded: [
                join(appRoot, 'src/main.ts'),
                installed('dom/dist/index.js'),
                installed('core/dist/index.js'),
            ],
            alias: [{ find: '@', replacement: join(appRoot, 'src') }],
        });

        expect(buildEnd).not.toThrow();
    });
});
