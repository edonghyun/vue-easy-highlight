import {
    computeSegments,
    decorationTarget,
    rootAttributes,
    segmentElements,
} from '@overlapmark/core';
import type {
    ElementSpec,
    Highlight,
    HoverDetail,
    PointDetail,
    RenderOptions,
    SelectDetail,
    Segment,
} from '@overlapmark/core';
import {
    attachInteractions,
    captureViewState,
    restoreViewState,
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
    /**
     * Decoration for each highlighted segment (style tier 3), such as a
     * count or an icon. The result is placed in
     * `<span data-om-skip aria-hidden="true">` right after the text of the
     * segment's innermost element, so it never counts toward offsets, is
     * left out of selections and copies (with the shipped stylesheet), and is
     * hidden from assistive technology. Decorations are presentational: do
     * not put interactive content (buttons, links, focusable elements) in
     * them. Return `null` or `''` for no decoration: the segment then gets no
     * container. Called on every render, so return a new Node each time.
     */
    decorate?: (segment: Segment<T>) => Node | string | null;
}

/** The element `spec` describes, without children. */
function elementOf(spec: ElementSpec): HTMLElement {
    const node = document.createElement(spec.tag);
    if (spec.className) node.className = spec.className;
    for (const [k, v] of Object.entries(spec.attrs)) node.setAttribute(k, v);
    for (const [k, v] of Object.entries(spec.style))
        node.style.setProperty(k, v);
    return node;
}

type EventMap<T> = {
    select: SelectDetail<T>;
    click: PointDetail<T>;
    dblclick: PointDetail<T>;
    hover: HoverDetail<T>;
};

export interface Highlighter<T = unknown> {
    update(options: Partial<HighlighterOptions<T>>): void;
    /**
     * Subscribes to an event; returns the function that removes this
     * subscription. Every call is a separate subscription, so a function
     * subscribed twice is called twice per event.
     */
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
            const specs = segmentElements(seg, opts);
            const elements = specs.map(elementOf);
            let parent: Node = frag;
            for (const node of elements) {
                parent.appendChild(node);
                parent = node;
            }
            parent.appendChild(document.createTextNode(seg.text));
            const target = decorationTarget(seg, specs);
            const decoration =
                target && opts.decorate ? opts.decorate(seg) : null;
            // Nothing to show gets no container, as in the framework adapters.
            if (target && decoration != null && decoration !== '') {
                const container = elementOf(target.container);
                container.append(decoration);
                elements[target.index].appendChild(container);
            }
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
            const view = captureViewState(el);

            opts = { ...opts, ...next };
            render();

            restoreViewState(el, view);
        },
        on(type, fn) {
            const set = listeners[type] as Set<typeof fn>;
            // A fresh wrapper per call: each unsubscribe removes its own
            // subscription, even when the same fn is subscribed again.
            const subscription: typeof fn = (d) => fn(d);
            set.add(subscription);
            return () => {
                set.delete(subscription);
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
