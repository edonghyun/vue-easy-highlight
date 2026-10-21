import { describe, expect, it, onTestFinished } from 'vitest';
import '../src/styles.css';
import type { Highlight } from '../src';
import { givenInDocument, givenRenderedRoot, select } from './helpers/mount';

// Normalise any computed color (rgb, color(srgb), oklab...) through a canvas, then compute relative luminance.
function rgba(css: string): [number, number, number, number] {
    const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
}
function luminance(css: string): number {
    const [r, g, b] = rgba(css)
        .slice(0, 3)
        .map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const bg = (el: Element) => getComputedStyle(el).backgroundColor;

const three = [
    { id: '1', start: 0, end: 14 },
    { id: '2', start: 5, end: 14 },
    { id: '3', start: 10, end: 14 },
];

/**
 * Depth at which darkening stops: the fallback of `var(--om-max-depth, 6)` in
 * src/styles.css. Kept in sync by hand; the test below fails if it drifts.
 */
const DEFAULT_MAX_DEPTH = 6;

/** Adds a user stylesheet before (`first`) or after every other stylesheet in <head>. */
function userCss(css: string, position: 'first' | 'last'): void {
    const style = document.createElement('style');
    style.textContent = css;
    if (position === 'first') document.head.prepend(style);
    else document.head.append(style);
    onTestFinished(() => style.remove());
}

/** Mounts a root inside an ancestor that sets the given CSS variables. */
function givenRootUnderAncestorVars(
    vars: Record<string, string>,
    highlights: Highlight[],
): HTMLElement {
    const wrapper = document.createElement('section');
    for (const [name, value] of Object.entries(vars))
        wrapper.style.setProperty(name, value);
    const root = givenRenderedRoot('abc', highlights);
    wrapper.appendChild(root);
    givenInDocument(wrapper);
    return root;
}

function markOf(root: Element): HTMLElement {
    return root.querySelector('mark')!;
}

describe('default stylesheet', () => {
    it('darkens deeper segments with the depth strategy', () => {
        const root = givenRenderedRoot('aaaa bbbb cccc', three, {
            strategy: 'depth',
        });

        const l = [...root.querySelectorAll<HTMLElement>('[data-depth]')].map(
            (el) => luminance(bg(el)),
        );

        expect(l).toHaveLength(3);
        expect(l[0]).toBeGreaterThan(l[1]);
        expect(l[1]).toBeGreaterThan(l[2]);
    });

    it('stops darkening at the default --om-max-depth', () => {
        const hs = Array.from({ length: DEFAULT_MAX_DEPTH + 2 }, (_, i) => ({
            id: String(i),
            start: i,
            end: DEFAULT_MAX_DEPTH + 2,
        }));
        const root = givenRenderedRoot('abcdefgh', hs, { strategy: 'depth' });

        const byDepth = new Map<string, string>();
        root.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) =>
            byDepth.set(el.dataset.depth!, bg(el)),
        );
        const at = (depth: number) => byDepth.get(String(depth));

        expect(at(DEFAULT_MAX_DEPTH)).not.toBe(at(DEFAULT_MAX_DEPTH - 1));
        expect(at(DEFAULT_MAX_DEPTH + 1)).toBe(at(DEFAULT_MAX_DEPTH));
        expect(at(DEFAULT_MAX_DEPTH + 2)).toBe(at(DEFAULT_MAX_DEPTH));
    });

    it('paints a translucent background on every nested mark with the layers strategy', () => {
        const root = givenRenderedRoot('aaaa bbbb cccc', three);

        const marks = root.querySelectorAll('mark.om-hl');

        // Segments [0,5), [5,10) and [10,14) nest 1 + 2 + 3 marks.
        expect(marks).toHaveLength(6);
        for (const el of marks) {
            const a = rgba(bg(el))[3];
            expect(a).toBeGreaterThan(0);
            expect(a).toBeLessThan(1);
        }
    });

    it('uses the default color, not the parent color, for an uncolored highlight nested in a colored one', () => {
        const nested = givenRenderedRoot('abcdef', [
            { id: 'a', start: 0, end: 6, color: '#ff0000' },
            { id: 'b', start: 2, end: 4 },
        ]);
        const alone = givenRenderedRoot('abcdef', [
            { id: 'c', start: 2, end: 4 },
        ]);

        const inner = nested.querySelector('mark[data-id="b"]')!;

        expect(bg(inner)).toBe(bg(alone.querySelector('mark[data-id="c"]')!));
        expect(bg(inner)).not.toBe(
            bg(nested.querySelector('mark[data-id="a"]')!),
        );
    });

    it('applies theme variables set on an ancestor of the root', () => {
        const red = markOf(
            givenRenderedRoot('abc', [
                { id: 'r', start: 0, end: 3, color: '#ff0000' },
            ]),
        );
        const plain = markOf(
            givenRenderedRoot('abc', [{ id: 'p', start: 0, end: 3 }]),
        );

        const themed = markOf(
            givenRootUnderAncestorVars({ '--om-default-color': '#ff0000' }, [
                { id: 't', start: 0, end: 3 },
            ]),
        );

        expect(bg(themed)).toBe(bg(red));
        expect(bg(themed)).not.toBe(bg(plain));
    });

    it('applies an --om-alpha override set on an ancestor', () => {
        const base = markOf(
            givenRenderedRoot('abc', [{ id: 'p', start: 0, end: 3 }]),
        );

        const overridden = markOf(
            givenRootUnderAncestorVars({ '--om-alpha': '100%' }, [
                { id: 'q', start: 0, end: 3 },
            ]),
        );

        expect(rgba(bg(overridden))[3]).toBe(1);
        expect(rgba(bg(base))[3]).toBeLessThan(1);
    });

    describe.each(['first', 'last'] as const)(
        'with user CSS placed %s in <head>',
        (position) => {
            it('lets a highlight.className rule override the library background', () => {
                userCss(
                    '.memo { background-color: rgb(255, 192, 203); }',
                    position,
                );
                const root = givenRenderedRoot('abc', [
                    { id: 'm', start: 0, end: 3, className: 'memo' },
                ]);

                expect(bg(markOf(root))).toBe('rgb(255, 192, 203)');
            });

            it('lets a highlight.className set --om-color', () => {
                userCss('.tint { --om-color: #00ff00; }', position);
                const tinted = givenRenderedRoot('abc', [
                    { id: 't', start: 0, end: 3, className: 'tint' },
                ]);
                const green = givenRenderedRoot('abc', [
                    { id: 'g', start: 0, end: 3, color: '#00ff00' },
                ]);

                expect(bg(markOf(tinted))).toBe(bg(markOf(green)));
            });
        },
    );

    it('keeps inline highlight.color above a user --om-color class', () => {
        userCss('.tint { --om-color: #00ff00; }', 'last');
        const root = givenRenderedRoot('abc', [
            { id: 'x', start: 0, end: 3, color: '#ff0000', className: 'tint' },
        ]);
        const red = givenRenderedRoot('abc', [
            { id: 'r', start: 0, end: 3, color: '#ff0000' },
        ]);

        expect(bg(markOf(root))).toBe(bg(markOf(red)));
    });

    it('paints --om-brush instead of a background color for the marker preset', () => {
        const root = givenRenderedRoot('abc', [
            { id: 'm', start: 0, end: 3, className: 'om-style-marker' },
        ]);

        const cs = getComputedStyle(markOf(root));

        expect(cs.backgroundImage.startsWith('url("data:image/svg+xml')).toBe(
            true,
        );
        expect(rgba(cs.backgroundColor)[3]).toBe(0);
    });

    it('preserves whitespace on the root', () => {
        const root = givenRenderedRoot('a  b', []);

        expect(getComputedStyle(root).whiteSpace).toBe('pre-wrap');
    });

    // The decoration is appended to mark "b", at the end of segment [6,15).
    it('leaves decoration text out of a selection that spans a decoration', () => {
        const text = 'Hello wonderful world';
        const root = givenRenderedRoot(
            text,
            [
                { id: 'a', start: 0, end: 15 },
                { id: 'b', start: 6, end: 21 },
            ],
            { decorate: { id: 'b', text: '[note]' } },
        );
        expect(root.textContent).toContain('[note]');

        select(root, 8, 18);

        expect(window.getSelection()!.toString()).toBe(text.slice(8, 18));
    });
});
