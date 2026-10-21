import {
    computeSegments,
    decorationTarget,
    rootAttributes,
    segmentElements,
    segmentKey,
} from '@overlapmark/core';
import type {
    ElementSpec,
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
    Text,
    computed,
    defineComponent,
    h,
    mergeProps,
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
     * nothing (`v-if`, or `null`, `undefined`, `false`, `''` or `[]` from a
     * render function) to leave a segment without a container.
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

/**
 * The props of the element `spec` describes. An empty class or style is left
 * out rather than set to nothing: the server renders a present `class` or
 * `style` key as an empty attribute, which the client never does.
 */
function propsOfSpec(spec: ElementSpec): Record<string, unknown> {
    const props: Record<string, unknown> = { ...spec.attrs };
    if (spec.className) props.class = spec.className;
    if (Object.keys(spec.style).length > 0) props.style = spec.style;
    return props;
}

/**
 * Whether `vnode` renders nothing: a comment (what `v-if`, `null`, `undefined`
 * and `false` become) or an empty text.
 */
function rendersNothing(vnode: VNode): boolean {
    return (
        vnode.type === Comment || (vnode.type === Text && vnode.children === '')
    );
}

/** The decoration container holding `content`, or `null` when the slot rendered nothing. */
function decorationVNode(
    container: ElementSpec,
    content: VNode[],
): VNode | null {
    if (content.every(rendersNothing)) return null;
    return h(container.tag, propsOfSpec(container), content);
}

/**
 * The elements of one segment, built innermost first; the outermost is keyed
 * by `segmentKey`. `decorate` renders the decoration slot.
 */
function segmentVNode(
    segment: Segment,
    options: RenderOptions,
    decorate: ((segment: Segment) => VNode[]) | undefined,
): VNode {
    const specs = segmentElements(segment, options);
    const target = decorationTarget(segment, specs);
    const decoration =
        target && decorate
            ? decorationVNode(target.container, decorate(segment))
            : null;
    // The children of element `i`: the element inside it (or the text), then
    // the decoration if `i` holds it.
    const childrenAt = (i: number, inner: VNodeChild): VNodeChild[] =>
        decoration && i === target?.index ? [inner, decoration] : [inner];
    let inner: VNodeChild = segment.text;
    for (let i = specs.length - 1; i > 0; i--)
        inner = h(specs[i].tag, propsOfSpec(specs[i]), childrenAt(i, inner));
    return h(
        specs[0].tag,
        {
            // A segment whose covering ids change gets a new element, so a
            // hover target is never patched into a different segment.
            key: segmentKey(segment),
            ...propsOfSpec(specs[0]),
        },
        childrenAt(0, inner),
    );
}

/**
 * Renders `text` with overlapping `highlights` in a `div`, and emits
 * `select`, `click`, `dblclick` and `hover` with core's detail objects.
 * Attributes and classes given to the component land on that `div`.
 */
export const Highlighter = defineComponent({
    name: 'Highlighter',
    // Merged by hand in the render function: Vue's own fallthrough would let
    // a caller's `data-om-strategy` override the root attributes core sets.
    inheritAttrs: false,
    props: {
        /** The source text. Positions are UTF-16 indices. */
        text: { type: String, required: true },
        /** `{ id, start, end, color?, className?, data? }`; `end` is exclusive. */
        highlights: {
            type: Array as PropType<readonly Highlight[]>,
            default: () => [],
        },
        // `default: undefined` leaves the defaults to core. For `focusable` it
        // also keeps Vue from reading an absent Boolean prop as `false`, while
        // a bare `focusable` attribute still casts to `true`.
        /** How overlaps are drawn. Default `'layers'`. */
        strategy: { type: String as PropType<Strategy>, default: undefined },
        /** Put `tabindex="0"` on highlighted segments; Enter/Space emits `click`. Default `true`. */
        focusable: { type: Boolean, default: undefined },
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
    setup(props, { attrs, emit, slots }) {
        const root = ref<HTMLElement>();
        const segments = computed(() =>
            segmentsOf(props.text, props.highlights),
        );
        // The text and segments the DOM shows: events between a change and
        // its flush must describe what the user sees, not what is about to
        // render. Snapshotted together, so `select` text and highlights agree.
        let rendered: { text: string; segments: readonly Segment[] } = {
            text: '',
            segments: [],
        };

        let detach: (() => void) | null = null;
        // Mounting and every KeepAlive activation attach; unmounting and
        // deactivation detach while emits still reach the parent, so the
        // leave for a hovered segment does too.
        const attach = (): void => {
            if (detach || !root.value) return;
            detach = attachInteractions(root.value, {
                getText: () => rendered.text,
                getSegments: () => rendered.segments,
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
            const rootSpec = rootAttributes(options);
            rendered = { text: props.text, segments: segments.value };
            return h(
                'div',
                // The caller's classes follow `om-root`; core's attributes
                // come last so the caller's cannot replace them.
                mergeProps({ class: rootSpec.className }, attrs, {
                    ref: root,
                    ...rootSpec.attrs,
                }),
                rendered.segments.map((segment) =>
                    segmentVNode(
                        segment,
                        options,
                        slots.decoration &&
                            ((segment) => slots.decoration({ segment })),
                    ),
                ),
            );
        };
    },
});
