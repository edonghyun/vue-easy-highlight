import { afterEach, describe, expect, it } from 'vitest';
import '../src/styles.css';
import { mount } from './helpers/mount';

// Normalise any computed color (rgb, color(srgb), oklab...) through a canvas, then compute relative luminance.
function rgba(css: string): [number, number, number, number] {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
}
function luminance(css: string): number {
    const [r, g, b] = rgba(css).slice(0, 3).map((v) => {
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

const userStyles: HTMLStyleElement[] = [];
/** Adds a user stylesheet before (`first`) or after every other stylesheet in <head>. */
function userCss(css: string, position: 'first' | 'last'): void {
    const style = document.createElement('style');
    style.textContent = css;
    if (position === 'first') document.head.prepend(style);
    else document.head.append(style);
    userStyles.push(style);
}

afterEach(() => {
    document.body.textContent = '';
    while (userStyles.length) userStyles.pop()!.remove();
});

describe('default stylesheet', () => {
    it('depth strategy: deeper segments are darker', () => {
        const root = mount('aaaa bbbb cccc', three, { strategy: 'depth' });
        const l = [...root.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => luminance(bg(el)));
        expect(l).toHaveLength(3);
        expect(l[0]).toBeGreaterThan(l[1]);
        expect(l[1]).toBeGreaterThan(l[2]);
    });

    it('depth darkening stops at --om-max-depth', () => {
        const hs = Array.from({ length: 8 }, (_, i) => ({ id: String(i), start: i, end: 8 }));
        const root = mount('abcdefgh', hs, { strategy: 'depth' });
        const byDepth = new Map<string, string>();
        root.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) => byDepth.set(el.dataset.depth!, bg(el)));
        expect(byDepth.get('6')).not.toBe(byDepth.get('5'));
        expect(byDepth.get('7')).toBe(byDepth.get('6'));
        expect(byDepth.get('8')).toBe(byDepth.get('6'));
    });

    it('layers strategy: every nested mark paints a translucent background', () => {
        const root = mount('aaaa bbbb cccc', three);
        const marks = root.querySelectorAll('mark.om-hl');
        expect(marks.length).toBeGreaterThan(3);
        for (const el of marks) {
            const a = rgba(bg(el))[3];
            expect(a).toBeGreaterThan(0);
            expect(a).toBeLessThan(1);
        }
    });

    it('layers: an uncolored highlight nested in a colored one uses the default color, not the parent color', () => {
        const nested = mount('abcdef', [
            { id: 'a', start: 0, end: 6, color: '#ff0000' },
            { id: 'b', start: 2, end: 4 },
        ]);
        const inner = nested.querySelector('mark[data-id="b"]')!;
        const alone = mount('abcdef', [{ id: 'c', start: 2, end: 4 }]).querySelector('mark[data-id="c"]')!;
        expect(bg(inner)).toBe(bg(alone));
        expect(bg(inner)).not.toBe(bg(nested.querySelector('mark[data-id="a"]')!));
    });

    it('theme variables set on an ancestor of the root take effect', () => {
        const red = mount('abc', [{ id: 'r', start: 0, end: 3, color: '#ff0000' }]).querySelector('mark')!;
        const plain = mount('abc', [{ id: 'p', start: 0, end: 3 }]).querySelector('mark')!;
        const wrapper = document.createElement('section');
        wrapper.style.setProperty('--om-default-color', '#ff0000');
        const themed = mount('abc', [{ id: 't', start: 0, end: 3 }]);
        wrapper.appendChild(themed);
        document.body.appendChild(wrapper);
        const mark = themed.querySelector('mark')!;
        expect(bg(mark)).toBe(bg(red));
        expect(bg(mark)).not.toBe(bg(plain));
    });

    it('an ancestor --om-alpha override takes effect', () => {
        const base = mount('abc', [{ id: 'p', start: 0, end: 3 }]).querySelector('mark')!;
        const wrapper = document.createElement('section');
        wrapper.style.setProperty('--om-alpha', '100%');
        const root = mount('abc', [{ id: 'q', start: 0, end: 3 }]);
        wrapper.appendChild(root);
        document.body.appendChild(wrapper);
        expect(rgba(bg(root.querySelector('mark')!))[3]).toBe(1);
        expect(rgba(bg(base))[3]).toBeLessThan(1);
    });

    for (const position of ['first', 'last'] as const) {
        it(`a user class from highlight.className wins over library rules (user CSS ${position})`, () => {
            userCss('.memo { background-color: rgb(255, 192, 203); } .tint { --om-color: #00ff00; }', position);
            const root = mount('abcdef', [
                { id: 'm', start: 0, end: 3, className: 'memo' },
                { id: 't', start: 3, end: 6, className: 'tint' },
            ]);
            expect(bg(root.querySelector('mark[data-id="m"]')!)).toBe('rgb(255, 192, 203)');
            const green = mount('abc', [{ id: 'g', start: 0, end: 3, color: '#00ff00' }]).querySelector('mark')!;
            expect(bg(root.querySelector('mark[data-id="t"]')!)).toBe(bg(green));
        });
    }

    it('inline highlight.color still wins over a user --om-color class', () => {
        userCss('.tint { --om-color: #00ff00; }', 'last');
        const root = mount('abc', [{ id: 'x', start: 0, end: 3, color: '#ff0000', className: 'tint' }]);
        const red = mount('abc', [{ id: 'r', start: 0, end: 3, color: '#ff0000' }]).querySelector('mark')!;
        expect(bg(root.querySelector('mark')!)).toBe(bg(red));
    });

    it('marker preset paints --om-brush instead of a background color', () => {
        const root = mount('abc', [{ id: 'm', start: 0, end: 3, className: 'om-style-marker' }]);
        const el = root.querySelector('mark')!;
        const cs = getComputedStyle(el);
        expect(cs.backgroundImage.startsWith('url("data:image/svg+xml')).toBe(true);
        expect(rgba(cs.backgroundColor)[3]).toBe(0);
    });

    it('root preserves whitespace', () => {
        const root = mount('a  b', []);
        expect(getComputedStyle(root).whiteSpace).toBe('pre-wrap');
    });
});
