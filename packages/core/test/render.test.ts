import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLOR, computeSegments, defaultBrush, rootAttributes, segmentElements } from '../src';

const A = { id: 'a', start: 0, end: 15, className: 'note', color: '#ff0000' };
const B = { id: 'b', start: 6, end: 21 };
const seg = computeSegments('Hello wonderful world', [A, B])[1]; // [6,15) depth 2

describe('segmentElements', () => {
    it('renders plain segments as span.om-seg', () => {
        const plain = computeSegments('abc', [])[0];
        expect(segmentElements(plain)).toEqual([
            { tag: 'span', className: 'om-seg', attrs: { 'data-om-start': '0' }, style: {} },
        ]);
    });
    it('layers: one mark per highlight, outer first, outer carries segment attrs', () => {
        const [outer, inner] = segmentElements(seg);
        expect(outer.className).toBe('om-seg om-hl note');
        expect(outer.attrs).toEqual({
            'data-om-start': '6',
            'data-depth': '2',
            'data-ids': 'a,b',
            'data-id': 'a',
            tabindex: '0',
        });
        expect(outer.style['--om-color']).toBe('#ff0000');
        expect(outer.style['--om-level']).toBe('0');
        expect(inner.className).toBe('om-hl');
        expect(inner.attrs).toEqual({ 'data-id': 'b' });
        expect(inner.style['--om-color']).toBeUndefined();
        expect(inner.style['--om-brush']).toBe(defaultBrush(DEFAULT_COLOR));
    });
    it('depth: a single mark with --om-depth and merged classes', () => {
        const els = segmentElements(seg, { strategy: 'depth' });
        expect(els).toHaveLength(1);
        expect(els[0].className).toBe('om-seg om-hl note');
        expect(els[0].style['--om-depth']).toBe('2');
        expect(els[0].attrs['data-id']).toBeUndefined();
    });
    it('focusable:false omits tabindex', () => {
        expect(segmentElements(seg, { focusable: false })[0].attrs.tabindex).toBeUndefined();
    });
    it('custom brush receives the resolved color', () => {
        const brush = vi.fn((c: string) => `linear-gradient(${c},${c})`);
        segmentElements(seg, { brush });
        expect(brush.mock.calls.map((c) => c[0])).toEqual(['#ff0000', DEFAULT_COLOR]);
    });
    it('rootAttributes defaults to layers', () => {
        expect(rootAttributes()).toEqual({ className: 'om-root', attrs: { 'data-om-strategy': 'layers' } });
    });
});
