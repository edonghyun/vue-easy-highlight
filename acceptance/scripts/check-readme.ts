import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface Framework {
    /** As in the root README heading `## Quick start (<heading>)`. */
    heading: string;
    pkg: string;
    /** The acceptance app's quick-start file. */
    file: string;
}

const frameworks: Framework[] = [
    { heading: 'vanilla JS', pkg: 'dom', file: 'vanilla/src/quick-start.ts' },
    { heading: 'Vue', pkg: 'vue', file: 'vue/src/QuickStart.vue' },
    { heading: 'React', pkg: 'react', file: 'react/src/QuickStart.tsx' },
    { heading: 'Svelte', pkg: 'svelte', file: 'svelte/src/QuickStart.svelte' },
];

/** Fenced code blocks in order, skipping install commands and markup. */
function codeBlocks(markdown: string): string[] {
    const blocks: string[] = [];
    const fence = /^```(\w*)\n([\s\S]*?)^```$/gm;
    for (const [, lang, body] of markdown.matchAll(fence)) {
        if (!['sh', 'html', 'css', ''].includes(lang)) blocks.push(body);
    }
    return blocks;
}

/** The first code block of the README section under `heading`. */
function sectionBlock(markdown: string, heading: string): string | undefined {
    const start = markdown.indexOf(`\n## ${heading}\n`);
    if (start < 0) return undefined;
    const rest = markdown.slice(start + 1);
    const end = rest.indexOf('\n## ', 1);
    return codeBlocks(end < 0 ? rest : rest.slice(0, end))[0];
}

/** Lines with runs of whitespace collapsed, blank lines dropped. */
const normalized = (code: string): string[] =>
    code
        .split('\n')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .filter((line) => line !== '');

function contains(haystack: string[], needle: string[]): boolean {
    for (let i = 0; i + needle.length <= haystack.length; i++) {
        if (needle.every((line, j) => haystack[i + j] === line)) return true;
    }
    return false;
}

const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const problems: string[] = [];
const rootReadme = read('README.md');
for (const { heading, pkg, file } of frameworks) {
    const expected = sectionBlock(rootReadme, `Quick start (${heading})`);
    if (!expected) {
        problems.push(`README.md: no code under "## Quick start (${heading})"`);
        continue;
    }
    const lines = normalized(expected);

    const pkgReadme = `packages/${pkg}/README.md`;
    const pkgBlock = codeBlocks(read(pkgReadme))[0];
    if (!pkgBlock || normalized(pkgBlock).join('\n') !== lines.join('\n'))
        problems.push(
            `${pkgReadme}: quick start differs from README.md (${heading})`,
        );

    const app = join(root, 'acceptance/apps', file);
    if (!existsSync(app)) {
        problems.push(`${relative(root, app)} does not exist (${heading})`);
        continue;
    }
    if (!contains(normalized(readFileSync(app, 'utf8')), lines))
        problems.push(
            `${relative(root, app)}: does not contain the README quick start (${heading})`,
        );
}

if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log('README quick starts match the package READMEs and the apps');
