import {
    computeSegments,
    rootAttributes,
    segmentElements,
    segmentKey,
} from '@overlapmark/core';
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    RenderOptions,
    Segment,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import {
    attachInteractions,
    captureViewState,
    restoreViewState,
} from '@overlapmark/core/dom';
import type { ViewState } from '@overlapmark/core/dom';
import {
    Comment,
    computed,
    defineComponent,
    h,
    onActivated,
    onBeforeUnmount,
    onBeforeUpdate,
    onDeactivated,
    onMounted,
    onUpdated,
    ref,
    toRaw,
} from 'vue';
import type { PropType, SlotsType, VNode, VNodeChild } from 'vue';

/** Scoped slots of `Highlighter`. */
export interface HighlighterSlots {
    /**
     * Decoration for each highlighted segment (style tier 3), such as a count
     * or an icon. It is rendered in `<span data-om-skip aria-hidden="true">`
     * right after the text of the segment's innermost element, so it never
     * counts toward offsets, is left out of selections and copies (with the
     * shipped stylesheet), and is hidden from assistive technology. Keep it
     * presentational: no buttons, links or other focusable content. Render
     * nothing (e.g. `v-if`) to leave a segment undecorated.
     */
    decoration: { segment: Segment };
}

/**
 * The segments of `text`, holding the caller's own highlight objects.
 *
 * `computeSegments` reads `highlights` as given, so when the caller keeps them
 * in reactive state, changes made in place (a push, a new `end`) re-render.
 * The segments then hold the raw objects behind any proxy, so events report
 * the very objects the caller created.
 */
function segmentsOf(text: string, highlights: readonly Highlight[]): Segment[] {
    return computeSegments(text, highlights).map((segment) => ({
        ...segment,
        highlights: segment.highlights.map(toRaw),
    }));
}

/** The decoration container of the DOM contract, or `null` when the slot rendered nothing. */
function decorationOf(content: VNode[]): VNode | null {
    if (content.every((vnode) => vnode.type === Comment)) return null;
    return h('span', { 'data-om-skip': '', 'aria-hidden': 'true' }, content);
}

/** The elements of one segment, outermost first, keyed by `segmentKey`. */
function segmentVNode(
    segment: Segment,
    options: RenderOptions,
    decoration: VNode | null,
): VNode {
    const specs = segmentElements(segment, options);
    let children: VNodeChild = decoration
        ? [segment.text, decoration]
        : segment.text;
    for (let i = specs.length - 1; i > 0; i--) {
        const spec = specs[i];
        children = [
            h(
                spec.tag,
                { class: spec.className, style: spec.style, ...spec.attrs },
                children,
            ),
        ];
    }
    const outer = specs[0];
    return h(
        outer.tag,
        {
            // A segment whose covering ids change gets a new element, so a
            // hover target is never patched into a different segment.
            key: segmentKey(segment),
            class: outer.className,
            style: outer.style,
            ...outer.attrs,
        },
        children,
    );
}

/**
 * Renders `text` with overlapping `highlights` in a `div`, and emits
 * `select`, `click`, `dblclick` and `hover` with core's detail objects.
 * Attributes and classes given to the component land on that `div`.
 */
export const Highlighter = defineComponent({
    name: 'Highlighter',
    props: {
        /** The source text. Positions are UTF-16 indices. */
        text: { type: String, required: true },
        /** `{ id, start, end, color?, className?, data? }`; `end` is exclusive. */
        highlights: {
            type: Array as PropType<readonly Highlight[]>,
            default: () => [],
        },
        /** How overlaps are drawn. */
        strategy: { type: String as PropType<Strategy>, default: 'layers' },
        /** Put `tabindex="0"` on highlighted segments; Enter/Space emits `click`. */
        focusable: { type: Boolean, default: true },
        /** Color baked into the `--om-brush` image for highlights without `color`. */
        defaultColor: { type: String, default: undefined },
        /** Returns a CSS image value for `--om-brush`. */
        brush: {
            type: Function as PropType<(color: string) => string>,
            default: undefined,
        },
        /** Shorter selections do not emit `select`. Default 1. */
        minSelectionLength: { type: Number, default: undefined },
        /**
         * Milliseconds without a selection change before a touch selection
         * emits `select`. Default 500; a change applies from the next
         * selection change.
         */
        touchSelectionDelay: { type: Number, default: undefined },
    },
    emits: {
        select: (_detail: SelectDetail) => true,
        click: (_detail: PointDetail) => true,
        dblclick: (_detail: PointDetail) => true,
        hover: (_detail: HoverDetail) => true,
    },
    slots: Object as SlotsType<HighlighterSlots>,
    setup(props, { emit, slots }) {
        const root = ref<HTMLElement>();
        const segments = computed(() =>
            segmentsOf(props.text, props.highlights),
        );
        // The segments the DOM shows: events between a prop change and its
        // flush must describe what the user sees, not what is about to render.
        let rendered: readonly Segment[] = [];

        let detach: (() => void) | null = null;
        // Mounting and every KeepAlive activation attach; unmounting and
        // deactivation detach while emits still reach the parent, so the
        // leave for a hovered segment does too.
        const attach = (): void => {
            if (detach || !root.value) return;
            detach = attachInteractions(root.value, {
                getText: () => props.text,
                getSegments: () => rendered,
                get minSelectionLength() {
                    return props.minSelectionLength;
                },
                get touchSelectionDelay() {
                    return props.touchSelectionDelay;
                },
                onSelect: (detail) => emit('select', detail),
                onClick: (detail) => emit('click', detail),
                onDblclick: (detail) => emit('dblclick', detail),
                onHover: (detail) => emit('hover', detail),
            });
        };
        const release = (): void => {
            detach?.();
            detach = null;
        };
        onMounted(attach);
        onActivated(attach);
        onDeactivated(release);
        onBeforeUnmount(release);

        // Both hooks run in the flush that patches the DOM, before core's
        // mutation observer re-checks the hovered segment.
        let view: ViewState | null = null;
        onBeforeUpdate(() => {
            view = root.value ? captureViewState(root.value) : null;
        });
        onUpdated(() => {
            if (root.value && view) restoreViewState(root.value, view);
            view = null;
        });

        return () => {
            const options: RenderOptions = {
                strategy: props.strategy,
                focusable: props.focusable,
                defaultColor: props.defaultColor,
                brush: props.brush,
            };
            const { className, attrs } = rootAttributes(options);
            rendered = segments.value;
            return h(
                'div',
                { ref: root, class: className, ...attrs },
                rendered.map((segment) =>
                    segmentVNode(
                        segment,
                        options,
                        segment.depth > 0 && slots.decoration
                            ? decorationOf(slots.decoration({ segment }))
                            : null,
                    ),
                ),
            );
        };
    },
});
