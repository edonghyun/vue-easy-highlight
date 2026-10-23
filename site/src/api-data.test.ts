import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
    CSS_CLASSES,
    CSS_VARIABLES,
    EVENTS,
    HIGHLIGHT_FIELDS,
    HIGHLIGHTER_METHODS,
    OPTIONS,
} from './api-data';

const core = (file: string) =>
    readFileSync(
        new URL(`../../packages/core/src/${file}`, import.meta.url),
        'utf8',
    );
const styles = core('styles.css');
const render = core('render.ts');

describe.each([
    ['OPTIONS', OPTIONS],
    ['HIGHLIGHT_FIELDS', HIGHLIGHT_FIELDS],
])('%s', (_, rows) => {
    test('gives every row a type and a description', () => {
        for (const row of Object.values(rows)) {
            expect(row.type).not.toBe('');
            expect(row.description).not.toBe('');
        }
    });
});

test('every event and method is described', () => {
    for (const e of Object.values(EVENTS)) {
        expect(e.payload).not.toBe('');
        expect(e.description).not.toBe('');
    }
    for (const m of Object.values(HIGHLIGHTER_METHODS)) {
        expect(m.signature).not.toBe('');
        expect(m.description).not.toBe('');
    }
});

test('every documented CSS variable is in the stylesheet', () => {
    expect(CSS_VARIABLES.length).toBeGreaterThan(0);
    for (const { name } of CSS_VARIABLES) expect(styles).toContain(name);
});

test('every documented class is rendered or styled by core', () => {
    expect(CSS_CLASSES.length).toBeGreaterThan(0);
    for (const { name } of CSS_CLASSES) expect(styles + render).toContain(name);
});

test('a name core lacks is caught', () => {
    expect(styles + render).not.toContain('--om-nope');
    expect(styles + render).not.toContain('om-style-nope');
});

test('every custom property core styles with is documented', () => {
    const used = new Set(styles.match(/--om-[a-z-]+/g));
    expect(used.size).toBeGreaterThan(0);
    expect(new Set(CSS_VARIABLES.map((v) => v.name))).toEqual(used);
});

test('data-om-id is documented as layers-only', () => {
    const hl = CSS_CLASSES.find((c) => c.name === 'om-hl')!;
    expect(hl.description).toContain('data-om-id');
    expect(hl.description).toContain('`layers` strategy');
});
