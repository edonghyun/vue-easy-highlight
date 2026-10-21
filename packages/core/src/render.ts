import { DEFAULT_COLOR, defaultBrush } from './brush';
import type { Segment } from './types';

export { DEFAULT_COLOR, defaultBrush };

export type Strategy = 'layers' | 'depth';

export interface RenderOptions {
    strategy?: Strategy;
    focusable?: boolean;
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
        defaultColor = DEFAULT_COLOR,
        brush = defaultBrush,
    } = options;
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
        'data-depth': String(depth),
        'data-ids': highlights.map((h) => h.id).join(','),
    };
    if (focusable) segAttrs.tabindex = '0';

    if (strategy === 'depth') {
        const classes: string[] = [];
        for (const h of highlights) {
            if (h.className && !classes.includes(h.className))
                classes.push(h.className);
        }
        const color = highlights.find((h) => h.color)?.color;
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
        if (h.color) style['--om-color'] = h.color;
        style['--om-brush'] = brush(h.color ?? defaultColor);
        const cls = h.className ? `om-hl ${h.className}` : 'om-hl';
        return {
            tag: 'mark' as const,
            className: i === 0 ? `om-seg ${cls}` : cls,
            attrs:
                i === 0
                    ? { ...segAttrs, 'data-id': h.id }
                    : { 'data-id': h.id },
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
 * so an id holding a comma cannot pass for two ids.
 */
export function segmentKey(segment: Segment): string {
    const ids = segment.highlights.map((h) => h.id).join('\u0000');
    return `${segment.start}:${segment.end}:${ids}`;
}

export function rootAttributes(options: RenderOptions = {}): {
    className: 'om-root';
    attrs: { 'data-om-strategy': Strategy };
} {
    return {
        className: 'om-root',
        attrs: { 'data-om-strategy': options.strategy ?? 'layers' },
    };
}
