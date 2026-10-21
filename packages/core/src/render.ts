import { DEFAULT_COLOR, defaultBrush } from './brush';
import { safeColor } from './color';
import type { Segment } from './types';

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

export interface RenderOptions {
    strategy?: Strategy;
    /** How nested layers combine with the `layers` strategy. Default `'multiply'`. */
    overlap?: Overlap;
    focusable?: boolean;
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

export function segmentElements<T>(
    segment: Segment<T>,
    options: RenderOptions = {},
): ElementSpec[] {
    const {
        strategy = 'layers',
        focusable = true,
        brush = defaultBrush,
    } = options;
    const defaultColor = safeColor(options.defaultColor) ?? DEFAULT_COLOR;
    const { highlights, depth, start } = segment;

    if (depth === 0 || highlights.length === 0) {
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
    if (focusable) segAttrs.tabindex = '0';

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

    return highlights.map((h, i) => {
        const style: Record<string, string> = { '--om-level': String(i) };
        const color = safeColor(h.color);
        if (color) style['--om-color'] = color;
        style['--om-brush'] = brush(color ?? defaultColor);
        const cls = h.className ? `om-hl ${h.className}` : 'om-hl';
        return {
            tag: 'mark' as const,
            className: i === 0 ? `om-seg ${cls}` : cls,
            attrs:
                i === 0
                    ? { ...segAttrs, 'data-om-id': h.id }
                    : { 'data-om-id': h.id },
            style,
        };
    });
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
export function rootAttributes(options: RenderOptions = {}): {
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
