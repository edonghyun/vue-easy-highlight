import { DEFAULT_COLOR, defaultBrush } from './brush';
import { safeColor } from './color';
import type { Highlight, Segment } from './types';

export { DEFAULT_COLOR, defaultBrush };

export type Strategy = 'layers' | 'depth';

/**
 * How nested layers of the `layers` strategy combine, set on the root as
 * `data-om-overlap` for the stylesheet:
 * - `multiply`: each layer multiplies with those under it, so a spot gets
 *   darker with every highlight that covers it, whatever their colors.
 * - `darken`: each layer's own color is mixed toward `--om-depth-ink` by
 *   `--om-depth-step` per nesting level. It darkens reliably only for colors
 *   of similar lightness.
 * - `none`: plain translucent layers.
 */
export type Overlap = 'multiply' | 'darken' | 'none';

export interface RenderOptions<T = unknown> {
    strategy?: Strategy;
    /** How nested layers combine with the `layers` strategy. Default `'multiply'`. */
    overlap?: Overlap;
    /**
     * Put `tabindex="0"` and `role="button"` on highlighted segments, with an
     * accessible description from `describe`. Default `true`.
     */
    focusable?: boolean;
    /**
     * Words the accessible description of a focusable segment from the
     * highlights covering it, in library order. Default: `'1 highlight'` /
     * `` `${n} highlights` ``. It is the segment's `aria-description`, so it
     * is never part of the text, a selection, a copy or the offsets. Return
     * `''` for no description.
     */
    describe?: (highlights: readonly Highlight<T>[]) => string;
    /**
     * Color of highlights without `color`: baked into their brush and set as
     * `--om-default-color` on the root.
     */
    defaultColor?: string;
    brush?: (color: string) => string;
}

export interface ElementSpec {
    tag: 'span' | 'mark';
    className: string;
    attrs: Record<string, string>;
    style: Record<string, string>;
}

/** The default `describe`: how many highlights cover a segment. */
function countHighlights(highlights: readonly Highlight[]): string {
    return highlights.length === 1
        ? '1 highlight'
        : `${highlights.length} highlights`;
}

/** The elements of one segment, outermost first: always at least one. */
export function segmentElements<T>(
    segment: Segment<T>,
    options: RenderOptions<T> = {},
): [ElementSpec, ...ElementSpec[]] {
    const {
        strategy = 'layers',
        focusable = true,
        brush = defaultBrush,
        describe = countHighlights,
    } = options;
    const defaultColor = safeColor(options.defaultColor) ?? DEFAULT_COLOR;
    const { highlights, depth, start } = segment;
    const first = highlights[0];

    if (depth === 0 || !first) {
        return [
            {
                tag: 'span',
                className: 'om-seg',
                attrs: { 'data-om-start': String(start) },
                style: {},
            },
        ];
    }

    const segAttrs: Record<string, string> = {
        'data-om-start': String(start),
        'data-om-depth': String(depth),
        'data-om-ids': highlights.map((h) => h.id).join(' '),
    };
    if (focusable) {
        // Activating a segment reports the highlights covering it, so it is
        // announced as a button: its text, then the description. An
        // attribute rather than an aria-describedby target, which would
        // need an id unique per instance and the same on server and client.
        segAttrs.tabindex = '0';
        segAttrs.role = 'button';
        const description = describe(highlights);
        if (description) segAttrs['aria-description'] = description;
    }

    if (strategy === 'depth') {
        const classes: string[] = [];
        for (const h of highlights) {
            if (h.className && !classes.includes(h.className))
                classes.push(h.className);
        }
        const color = highlights.map((h) => safeColor(h.color)).find(Boolean);
        const style: Record<string, string> = { '--om-depth': String(depth) };
        if (color) style['--om-color'] = color;
        style['--om-brush'] = brush(color ?? defaultColor);
        return [
            {
                tag: 'mark',
                className: ['om-seg', 'om-hl', ...classes].join(' '),
                attrs: segAttrs,
                style,
            },
        ];
    }

    const markOf = (h: Highlight<T>, i: number): ElementSpec => {
        const style: Record<string, string> = { '--om-level': String(i) };
        const color = safeColor(h.color);
        if (color) style['--om-color'] = color;
        style['--om-brush'] = brush(color ?? defaultColor);
        const cls = h.className ? `om-hl ${h.className}` : 'om-hl';
        return {
            tag: 'mark',
            className: i === 0 ? `om-seg ${cls}` : cls,
            attrs:
                i === 0
                    ? { ...segAttrs, 'data-om-id': h.id }
                    : { 'data-om-id': h.id },
            style,
        };
    };
    return [
        markOf(first, 0),
        ...highlights.slice(1).map((h, i) => markOf(h, i + 1)),
    ];
}

/**
 * The key a framework adapter gives a segment's element when it diffs a
 * re-render: built from `start`, `end` and the covering highlight ids, so it
 * is unique among the segments of one render and changes whenever the ids
 * covering the segment change. An element is then reused only for the same
 * highlights, and a stale hover target is never patched into a different
 * segment. Ids are joined with U+0000, which ids do not contain in practice,
 * so an id holding a space cannot pass for two ids.
 */
export function segmentKey(segment: Segment): string {
    const ids = segment.highlights.map((h) => h.id).join('\u0000');
    return `${segment.start}:${segment.end}:${ids}`;
}

/**
 * The class, attributes and inline style of the root element. `style` holds
 * `--om-default-color` when `defaultColor` is given and safe, and is empty
 * otherwise.
 */
export function rootAttributes<T>(options: RenderOptions<T> = {}): {
    className: 'om-root';
    attrs: { 'data-om-strategy': Strategy; 'data-om-overlap': Overlap };
    style: Record<string, string>;
} {
    const defaultColor = safeColor(options.defaultColor);
    return {
        className: 'om-root',
        attrs: {
            'data-om-strategy': options.strategy ?? 'layers',
            'data-om-overlap': options.overlap ?? 'multiply',
        },
        style: defaultColor ? { '--om-default-color': defaultColor } : {},
    };
}

/** Where a segment's decoration (style tier 3) goes in its rendered elements. */
export interface DecorationTarget {
    /**
     * Index in the segment's `segmentElements` of the element holding the
     * decoration: the innermost one. The container is its last child, right
     * after the segment text.
     */
    index: number;
    /** The decoration container: skipped by offsets, hidden from assistive technology. */
    container: ElementSpec;
}

/**
 * The one placement rule for decorations: only highlighted segments get one,
 * as the last child of their innermost element, after the text. `elements`
 * is what `segmentElements` returned for `segment`. Returns `null` for a
 * plain segment.
 */
export function decorationTarget(
    segment: Segment,
    elements: readonly ElementSpec[],
): DecorationTarget | null {
    if (segment.depth === 0 || elements.length === 0) return null;
    return {
        index: elements.length - 1,
        container: {
            tag: 'span',
            className: '',
            attrs: { 'data-om-skip': '', 'aria-hidden': 'true' },
            style: {},
        },
    };
}
