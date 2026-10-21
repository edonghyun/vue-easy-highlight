import { afterEach, describe, expect, it } from 'vitest';
import '../src/styles.css';
import { computeSegments, rootAttributes, segmentElements } from '../src';
import type { Highlight, RenderOptions } from '../src';

function mount(text: string, highlights: Highlight[], options: RenderOptions = {}): HTMLElement {
    const root = document.createElement('div');
    const r = rootAttributes(options);
    root.className = r.className;
    for (const [k, v] of Object.entries(r.attrs)) root.setAttribute(k, v);
    for (const seg of computeSegments(text, highlights)) {
        let parent: HTMLElement = root;
        for (const spec of segmentElements(seg, options)) {
            const el = document.createElement(spec.tag);
            el.className = spec.className;
            for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
            for (const [k, v] of Object.entries(spec.style)) el.style.setProperty(k, v);
            parent.appendChild(el);
            parent = el;
        }
        parent.append(seg.text);
    }
    document.body.appendChild(root);
    return root;
}

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

afterEach(() => {
    document.body.textContent = '';
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
