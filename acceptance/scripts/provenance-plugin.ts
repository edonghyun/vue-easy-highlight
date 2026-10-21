import { join, normalize, sep } from 'node:path';
import type { Alias, Plugin } from 'vite';

const scope = /@overlapmark\//;
const specifiers = [
    '@overlapmark/core',
    '@overlapmark/core/dom',
    '@overlapmark/core/styles.css',
    '@overlapmark/dom',
    '@overlapmark/vue',
    '@overlapmark/react',
    '@overlapmark/svelte',
];

/** The file path of a Vite module id, without its query. */
const pathOf = (id: string): string => normalize(id.replace(/[?#].*$/, ''));

/**
 * Proves at build time that the app bundles the installed tarballs: records
 * where every `@overlapmark/*` import resolved and every `@overlapmark/*`
 * file that loaded, and fails the build if any lies outside
 * `<appRoot>/node_modules` or inside a `packages/` directory, if an alias
 * redirects an `@overlapmark/*` import, or if no `@overlapmark/*` import was
 * seen at all (so a broken recorder cannot pass).
 */
export function overlapmarkProvenance(appRoot: string): Plugin {
    const nodeModules = join(appRoot, 'node_modules') + sep;
    const packages = `${sep}packages${sep}`;
    const recorded = new Set<string>();
    const aliased: string[] = [];

    return {
        name: 'overlapmark-provenance',
        // Before Vite's resolver, so every import specifier is seen. Aliases
        // apply even earlier, which is why configResolved checks them.
        enforce: 'pre',
        configResolved(config) {
            const aliases: readonly Alias[] = config.resolve.alias;
            for (const { find, replacement } of aliases) {
                const redirected = specifiers.some((s) =>
                    typeof find === 'string'
                        ? s === find || s.startsWith(`${find}/`)
                        : find.test(s),
                );
                if (redirected) aliased.push(`${find} -> ${replacement}`);
            }
        },
        async resolveId(source, importer, options) {
            if (!source.startsWith('@overlapmark/')) return null;
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (resolved) recorded.add(pathOf(resolved.id));
            return resolved;
        },
        load(id) {
            if (scope.test(id)) recorded.add(pathOf(id));
            return null;
        },
        buildEnd() {
            const problems = [...aliased.map((a) => `alias ${a}`)];
            for (const path of recorded) {
                if (!path.startsWith(nodeModules) || path.includes(packages))
                    problems.push(path);
            }
            if (problems.length > 0) {
                throw new Error(
                    `@overlapmark imports must come from ${nodeModules}, not:\n` +
                        problems.map((p) => `  ${p}`).join('\n'),
                );
            }
            if (recorded.size === 0) {
                throw new Error(
                    'overlapmark-provenance saw no @overlapmark import',
                );
            }
        },
    };
}
