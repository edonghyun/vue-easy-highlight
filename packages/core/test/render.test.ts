import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    onTestFinished,
    vi,
} from 'vitest';
import {
    DEFAULT_COLOR,
    computeSegments,
    defaultBrush,
    rootAttributes,
    segmentAt,
    segmentElements,
    segmentKey,
    decorationTarget,
    type Highlight,
    type RenderOptions,
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
            'data-om-depth': '2',
            'data-om-ids': 'a b',
            'data-om-id': 'a',
            tabindex: '0',
        });
        expect(inner.attrs).toEqual({ 'data-om-id': 'b' });
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

    it('lists data-om-ids in highlight order, not input order (§4.3)', () => {
        const segment = segmentOf([B, A], 6);

        const [outer] = segmentElements(segment);

        expect(outer.attrs['data-om-ids']).toBe('a b');
    });

    it('marks a segment with data-om-ids joined by spaces', () => {
        const [outer] = segmentElements(overlap);

        expect(outer.attrs['data-om-ids']).toBe('a b');
    });

    it('emits none of the unprefixed attributes', () => {
        const specs = [
            ...segmentElements(overlap),
            ...segmentElements(overlap, { strategy: 'depth' }),
        ];

        const keys = specs.flatMap((s) => Object.keys(s.attrs));

        expect(keys).toContain('data-om-start');
        expect(keys).not.toContain('data-id');
        expect(keys).not.toContain('data-ids');
        expect(keys).not.toContain('data-depth');
    });
});

describe('segmentElements with the depth strategy', () => {
    it('renders a single mark carrying --om-depth and no data-om-id', () => {
        const elements = segmentElements(overlap, { strategy: 'depth' });

        expect(elements).toHaveLength(1);
        expect(elements[0].style['--om-depth']).toBe('2');
        expect(elements[0].attrs['data-om-id']).toBeUndefined();
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
            attrs: {
                'data-om-strategy': 'layers',
                'data-om-overlap': 'multiply',
            },
            style: {},
        });
    });

    it('reports the depth strategy when given', () => {
        expect(rootAttributes({ strategy: 'depth' }).attrs).toEqual({
            'data-om-strategy': 'depth',
            'data-om-overlap': 'multiply',
        });
    });

    it('marks the root with the overlap mode, multiply by default', () => {
        const modes = (['multiply', 'darken', 'none'] as const).map(
            (overlap) => rootAttributes({ overlap }).attrs['data-om-overlap'],
        );

        expect(rootAttributes().attrs['data-om-overlap']).toBe('multiply');
        expect(modes).toEqual(['multiply', 'darken', 'none']);
    });

    it('puts --om-default-color inline on the root only when defaultColor is given', () => {
        const given = rootAttributes({ defaultColor: '#123456' });

        const absent = rootAttributes();

        expect(given.style).toEqual({ '--om-default-color': '#123456' });
        expect(absent.style).toEqual({});
    });

    it('leaves an unsafe defaultColor off the root', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());

        const unsafe = rootAttributes({
            defaultColor: 'blue} body {color: red',
        });

        expect(unsafe.style).toEqual({});
        expect(warn).toHaveBeenCalled();
    });
});

describe('segmentKey', () => {
    it('gives every segment of one render a different key, plain ones included', () => {
        const C = { id: 'c', start: 17, end: 19 };
        const segments = computeSegments(text, [A, C]);

        const keys = segments.map(segmentKey);

        // [0,15) a · [15,17) plain · [17,19) c · [19,21) plain
        expect(segments.map((s) => s.depth)).toEqual([1, 0, 1, 0]);
        expect(new Set(keys).size).toBe(segments.length);
    });

    it('gives the same key to the same segment computed again', () => {
        const again = segmentOf([{ ...A }, { ...B }], 6);

        expect(segmentKey(again)).toBe(segmentKey(overlap));
    });

    it('changes when an id covering the segment changes', () => {
        const renamed = segmentOf([A, { ...B, id: 'b2' }], 6);

        expect(renamed.start).toBe(overlap.start);
        expect(renamed.end).toBe(overlap.end);
        expect(segmentKey(renamed)).not.toBe(segmentKey(overlap));
    });

    it('changes when the segment end changes', () => {
        const shorter = segmentOf([{ ...A, end: 10 }], 0);
        const longer = segmentOf([A], 0);

        expect(shorter.highlights.map((h) => h.id)).toEqual(['a']);
        expect(segmentKey(shorter)).not.toBe(segmentKey(longer));
    });

    it('does not mistake one id containing a comma for two ids', () => {
        const oneId = segmentOf([{ id: 'a,b', start: 0, end: 15 }], 0);
        const twoIds = segmentOf(
            [
                { id: 'a', start: 0, end: 15 },
                { id: 'b', start: 0, end: 15 },
            ],
            0,
        );

        expect(segmentKey(oneId)).not.toBe(segmentKey(twoIds));
    });
});

describe('decorationTarget', () => {
    const container = {
        tag: 'span',
        className: '',
        attrs: { 'data-om-skip': '', 'aria-hidden': 'true' },
        style: {},
    };

    it.each([
        { strategy: 'layers' as const, index: 1 },
        { strategy: 'depth' as const, index: 0 },
    ])(
        'places the decoration of a highlighted segment in its innermost element with the $strategy strategy',
        ({ strategy, index }) => {
            const elements = segmentElements(overlap, { strategy });

            const target = decorationTarget(overlap, elements);

            expect(elements).toHaveLength(index + 1);
            expect(target).toEqual({ index, container });
        },
    );

    it('gives a plain segment no decoration', () => {
        const plain = segmentOf([{ id: 'x', start: 0, end: 5 }], 10);

        const target = decorationTarget(plain, segmentElements(plain));

        expect(plain.depth).toBe(0);
        // Live positive control: a highlighted segment of the same render gets one.
        const highlighted = segmentOf([{ id: 'x', start: 0, end: 5 }], 0);
        expect(target).toBeNull();
        expect(
            decorationTarget(highlighted, segmentElements(highlighted)),
        ).not.toBeNull();
    });
});

describe('segmentElements with an unsafe color', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    const unsafe = 'red; position: fixed';
    const bySafety = (color: string) => ({ id: 'a', start: 0, end: 5, color });

    function styleOf(color: string, options: RenderOptions = {}) {
        return segmentElements(segmentOf([bySafety(color)], 0), options)[0]
            .style;
    }

    it.each(['layers', 'depth'] as const)(
        'falls back to the default color with the %s strategy',
        (strategy) => {
            const style = styleOf(unsafe, { strategy });
            const control = styleOf('#123456', { strategy });

            expect(style['--om-color']).toBeUndefined();
            expect(style['--om-brush']).toBe(defaultBrush(DEFAULT_COLOR));
            expect(control['--om-color']).toBe('#123456');
        },
    );

    it('falls back to the built-in color for an unsafe defaultColor', () => {
        const highlighted = segmentOf([{ id: 'a', start: 0, end: 5 }], 0);

        const [element] = segmentElements(highlighted, {
            defaultColor: unsafe,
        });
        const [control] = segmentElements(highlighted, {
            defaultColor: '#123456',
        });

        expect(element.style['--om-brush']).toBe(defaultBrush(DEFAULT_COLOR));
        expect(control.style['--om-brush']).toBe(defaultBrush('#123456'));
    });
});
