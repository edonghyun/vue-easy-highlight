import {
    computeSegments,
    rootAttributes,
    segmentElements,
} from '@overlapmark/core';
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    RenderOptions,
    SelectDetail,
    Segment,
} from '@overlapmark/core';
import {
    attachInteractions,
    createRangeFromOffsets,
    getSelectionOffsets,
} from '@overlapmark/core/dom';

export interface HighlighterOptions<T = unknown> extends RenderOptions {
    text: string;
    highlights?: readonly Highlight<T>[];
    minSelectionLength?: number;
    /**
     * Milliseconds without a selection change before a touch selection emits
     * `select`. Default 500. A value changed by `update()` applies from the
     * next selection change. The re-render of `update()` is one, so a touch
     * selection already waiting restarts its wait with the new value.
     */
    touchSelectionDelay?: number;
}

type EventMap<T> = {
    select: SelectDetail<T>;
    click: PointDetail<T>;
    dblclick: PointDetail<T>;
    hover: HoverDetail<T>;
};

export interface Highlighter<T = unknown> {
    update(options: Partial<HighlighterOptions<T>>): void;
    /** Subscribes to an event; returns the function that unsubscribes. */
    on<K extends keyof EventMap<T>>(
        type: K,
        fn: (d: EventMap<T>[K]) => void,
    ): () => void;
    getSegments(): readonly Segment<T>[];
    destroy(): void;
}

export function createHighlighter<T>(
    el: HTMLElement,
    options: HighlighterOptions<T>,
): Highlighter<T> {
    let opts: HighlighterOptions<T> = { ...options };
    let segments: readonly Segment<T>[] = [];
    let destroyed = false;
    const listeners: {
        [K in keyof EventMap<T>]: Set<(d: EventMap<T>[K]) => void>;
    } = {
        select: new Set(),
        click: new Set(),
        dblclick: new Set(),
        hover: new Set(),
    };

    const emit = <K extends keyof EventMap<T>>(
        type: K,
        detail: EventMap<T>[K],
    ): void => {
        for (const fn of [...listeners[type]]) fn(detail);
    };

    const render = (): void => {
        const rootAttrs = rootAttributes(opts);
        el.classList.add(rootAttrs.className);
        for (const [k, v] of Object.entries(rootAttrs.attrs))
            el.setAttribute(k, v);

        segments = computeSegments(opts.text, opts.highlights ?? []);
        const frag = document.createDocumentFragment();
        for (const seg of segments) {
            let parent: Node = frag;
            for (const spec of segmentElements(seg, opts)) {
                const node = document.createElement(spec.tag);
                node.className = spec.className;
                for (const [k, v] of Object.entries(spec.attrs))
                    node.setAttribute(k, v);
                for (const [k, v] of Object.entries(spec.style))
                    node.style.setProperty(k, v);
                parent.appendChild(node);
                parent = node;
            }
            parent.appendChild(document.createTextNode(seg.text));
        }
        el.replaceChildren(frag);
    };

    render();

    // attachInteractions reads its options live, so these getters pick up
    // update() changes without re-attaching (which would drop pending state).
    const detach = attachInteractions<T>(el, {
        getText: () => opts.text,
        getSegments: () => segments,
        get minSelectionLength() {
            return opts.minSelectionLength;
        },
        get touchSelectionDelay() {
            return opts.touchSelectionDelay;
        },
        onSelect: (d) => emit('select', d),
        onClick: (d) => emit('click', d),
        onDblclick: (d) => emit('dblclick', d),
        onHover: (d) => emit('hover', d),
    });

    return {
        update(next) {
            if (destroyed) return;
            const selection = window.getSelection();
            const saved = getSelectionOffsets(el, selection);
            const active = document.activeElement;
            const focusedStart =
                active && el.contains(active)
                    ? active
                          .closest('[data-om-start]')
                          ?.getAttribute('data-om-start')
                    : null;

            opts = { ...opts, ...next };
            render();

            if (saved) {
                const range = createRangeFromOffsets(
                    el,
                    saved.start,
                    saved.end,
                );
                if (range && selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            if (focusedStart != null) {
                const target =
                    el.querySelector<HTMLElement>(
                        `[data-om-start="${focusedStart}"][tabindex]`,
                    ) ?? null;
                target?.focus({ preventScroll: true });
            }
        },
        on(type, fn) {
            const set = listeners[type] as Set<typeof fn>;
            set.add(fn);
            return () => {
                set.delete(fn);
            };
        },
        getSegments: () => segments,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            detach();
            for (const set of Object.values(listeners)) set.clear();
            el.classList.remove('om-root');
            el.removeAttribute('data-om-strategy');
            if (!el.getAttribute('class')) el.removeAttribute('class');
            el.textContent = opts.text;
        },
    };
}
