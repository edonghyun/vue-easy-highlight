import { describe, expect, it } from 'vitest';
import {
    DEFAULT_COLOR,
    computeSegments,
    defaultBrush,
    rootAttributes,
    segmentAt,
    segmentElements,
    type Highlight,
} from '../src';

const text = 'Hello wonderful world';
const A = { id: 'a', start: 0, end: 15, className: 'note', color: '#ff0000' };
const B = { id: 'b', start: 6, end: 21 };

/** The segment at `offset` for `highlights` over `text`. */
function segmentOf(highlights: Highlight[], offset: number) {
    return segmentAt(computeSegments(text, highlights), offset)!;
}

/** [6, 15): covered by A (outer, colored, classed) and B (inner, plain). */
const overlap = segmentOf([A, B], 6);

describe('segmentElements', () => {
    it('renders a plain segment as a single span.om-seg', () => {
        const plain = computeSegments('abc', [])[0];

        expect(segmentElements(plain)).toEqual([
            {
                tag: 'span',
                className: 'om-seg',
                attrs: { 'data-om-start': '0' },
                style: {},
            },
        ]);
    });

    it('omits tabindex when focusable is false', () => {
        const [outer] = segmentElements(overlap, { focusable: false });

        expect(outer.attrs.tabindex).toBeUndefined();
    });
});

describe('segmentElements with the layers strategy', () => {
    it('renders one mark per highlight, outermost first', () => {
        const elements = segmentElements(overlap);

        expect(elements.map((e) => [e.tag, e.className])).toEqual([
            ['mark', 'om-seg om-hl note'],
            ['mark', 'om-hl'],
        ]);
    });

    it('puts the segment attributes on the outermost mark only', () => {
        const [outer, inner] = segmentElements(overlap);

        expect(outer.attrs).toEqual({
            'data-om-start': '6',
            'data-depth': '2',
            'data-ids': 'a,b',
            'data-id': 'a',
            tabindex: '0',
        });
        expect(inner.attrs).toEqual({ 'data-id': 'b' });
    });

    it('gives each mark its own level, color and brush', () => {
        const [outer, inner] = segmentElements(overlap);

        expect(outer.style).toEqual({
            '--om-level': '0',
            '--om-color': '#ff0000',
            '--om-brush': defaultBrush('#ff0000'),
        });
        expect(inner.style).toEqual({
            '--om-level': '1',
            '--om-brush': defaultBrush(DEFAULT_COLOR),
        });
    });

    it('paints uncolored highlights with the defaultColor option', () => {
        const [, inner] = segmentElements(overlap, { defaultColor: '#00ff00' });

        expect(inner.style['--om-brush']).toBe(defaultBrush('#00ff00'));
    });

    it('paints each mark with a custom brush applied to its resolved color', () => {
        const brush = (c: string) => `linear-gradient(${c},${c})`;

        const elements = segmentElements(overlap, { brush });

        expect(elements.map((e) => e.style['--om-brush'])).toEqual([
            'linear-gradient(#ff0000,#ff0000)',
            `linear-gradient(${DEFAULT_COLOR},${DEFAULT_COLOR})`,
        ]);
    });

    it('lists data-ids in highlight order, not input order (§4.3)', () => {
        const segment = segmentOf([B, A], 6);

        const [outer] = segmentElements(segment);

        expect(outer.attrs['data-ids']).toBe('a,b');
    });
});

describe('segmentElements with the depth strategy', () => {
    it('renders a single mark carrying --om-depth and no data-id', () => {
        const elements = segmentElements(overlap, { strategy: 'depth' });

        expect(elements).toHaveLength(1);
        expect(elements[0].style['--om-depth']).toBe('2');
        expect(elements[0].attrs['data-id']).toBeUndefined();
    });

    it('merges the highlight classes into the mark', () => {
        const [mark] = segmentElements(overlap, { strategy: 'depth' });

        expect(mark.className).toBe('om-seg om-hl note');
    });

    it('lists a className shared by several highlights once', () => {
        const segment = segmentOf([A, { ...B, className: 'note' }], 6);

        const [mark] = segmentElements(segment, { strategy: 'depth' });

        expect(mark.className).toBe('om-seg om-hl note');
    });

    it('takes the color of the first highlight that has one', () => {
        const segment = segmentOf(
            [
                { id: 'plain', start: 0, end: 10 },
                { id: 'green', start: 0, end: 8, color: '#00ff00' },
                { id: 'blue', start: 0, end: 6, color: '#0000ff' },
            ],
            0,
        );

        const [mark] = segmentElements(segment, { strategy: 'depth' });

        expect(mark.style['--om-color']).toBe('#00ff00');
        expect(mark.style['--om-brush']).toBe(defaultBrush('#00ff00'));
    });

    it('paints with the defaultColor option when no highlight has a color', () => {
        const segment = segmentOf([B], 6);

        const [mark] = segmentElements(segment, {
            strategy: 'depth',
            defaultColor: '#00ff00',
        });

        expect(mark.style['--om-color']).toBeUndefined();
        expect(mark.style['--om-brush']).toBe(defaultBrush('#00ff00'));
    });
});

describe('rootAttributes', () => {
    it('defaults to the layers strategy', () => {
        expect(rootAttributes()).toEqual({
            className: 'om-root',
            attrs: { 'data-om-strategy': 'layers' },
        });
    });

    it('reports the depth strategy when given', () => {
        expect(rootAttributes({ strategy: 'depth' })).toEqual({
            className: 'om-root',
            attrs: { 'data-om-strategy': 'depth' },
        });
    });
});
