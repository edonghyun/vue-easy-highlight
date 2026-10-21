<!--
    @component
    Renders `text` with overlapping `highlights` in a `div`, and calls
    `onselect`, `onclick`, `ondblclick` and `onhover` with core's detail
    objects. `class` and the other attributes given to the component land on
    that `div`.
-->
<script lang="ts" module>
    import type {
        ElementSpec,
        Highlight,
        HoverDetail,
        Overlap,
        PointDetail,
        Segment,
        SelectDetail,
        Strategy,
    } from '@overlapmark/core';
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    /** The props `Highlighter` adds to those of its root `div`. */
    export interface HighlighterOwnProps<T = unknown> {
        /** The source text. Positions are UTF-16 indices. */
        text: string;
        /** `{ id, start, end, color?, className?, data? }`; `end` is exclusive. Default `[]`. */
        highlights?: readonly Highlight<T>[];
        /** How overlaps are drawn. Default `'layers'`. */
        strategy?: Strategy;
        /** How nested layers combine with the `layers` strategy. Default `'multiply'`. */
        overlap?: Overlap;
        /** Put `tabindex="0"` on highlighted segments; Enter/Space calls `onclick`. Default `true`. */
        focusable?: boolean;
        /** Color of highlights without `color`: set on the root as `--om-default-color` and baked into their `--om-brush`. */
        defaultColor?: string;
        /** Returns a CSS image value for `--om-brush`. */
        brush?: (color: string) => string;
        /** Shorter selections do not call `onselect`. Default 1. */
        minSelectionLength?: number;
        /**
         * Milliseconds without a selection change before a touch selection
         * calls `onselect`. Default 500; a change applies from the next
         * selection change.
         */
        touchSelectionDelay?: number;
        /** Classes added to the root `div` after `om-root`. */
        class?: string;
        /** A confirmed text selection inside the component. */
        onselect?: (detail: SelectDetail<T>) => void;
        /** A click, or Enter/Space on a focused highlight. Not a DOM `onclick`. */
        onclick?: (detail: PointDetail<T>) => void;
        /** A double click. Not a DOM `ondblclick`. */
        ondblclick?: (detail: PointDetail<T>) => void;
        /** The mouse entered or left a highlighted segment. */
        onhover?: (detail: HoverDetail<T>) => void;
        /**
         * Decoration for each highlighted segment (style tier 3), such as a
         * count or an icon. It is rendered in
         * `<span data-om-skip aria-hidden="true">` right after the text of the
         * segment's innermost element, so it never counts toward offsets, is
         * left out of selections and copies (with the shipped stylesheet),
         * and is hidden from assistive technology. Keep it presentational: no
         * buttons, links or other focusable content.
         */
        decoration?: Snippet<[Segment<T>]>;
    }

    /**
     * The props of `Highlighter`: its own, and the attributes of its root
     * `div`. The `div`'s `onselect`, `onclick` and `ondblclick` give way to
     * the component's callbacks, which receive core's detail objects; the
     * component renders the children itself.
     */
    export type HighlighterProps<T = unknown> = Omit<
        HTMLAttributes<HTMLDivElement>,
        keyof HighlighterOwnProps | 'children'
    > &
        HighlighterOwnProps<T>;

    /**
     * The attributes of the element `spec` describes. An empty class or
     * style is left out rather than set to nothing: the server renders a
     * present `class` or `style` as an empty attribute, which the client
     * never does.
     */
    function attributesOf(spec: ElementSpec): Record<string, string> {
        const attributes = { ...spec.attrs };
        if (spec.className) attributes.class = spec.className;
        const style = styleText(spec.style);
        if (style) attributes.style = style;
        return attributes;
    }

    /** `style` as the text of a `style` attribute. */
    function styleText(style: Record<string, string>): string {
        return Object.entries(style)
            .map(([name, value]) => `${name}: ${value}`)
            .join('; ');
    }

    /**
     * The root's `style`: the caller's, then core's properties so they win;
     * `undefined` when both are empty, so no empty attribute renders.
     */
    function rootStyleOf(
        own: string | null | undefined,
        core: Record<string, string>,
    ): string | undefined {
        return [own, styleText(core)].filter(Boolean).join('; ') || undefined;
    }
</script>

<script lang="ts" generics="T = unknown">
    import {
        computeSegments,
        decorationTarget,
        rootAttributes,
        segmentElements,
        segmentKey,
    } from '@overlapmark/core';
    import type { DecorationTarget, RenderOptions } from '@overlapmark/core';
    import {
        attachInteractions,
        captureViewState,
        restoreViewState,
    } from '@overlapmark/core/dom';
    import type { ViewState } from '@overlapmark/core/dom';
    import { onMount } from 'svelte';

    let {
        text,
        highlights = [],
        strategy,
        overlap,
        focusable,
        defaultColor,
        brush,
        minSelectionLength,
        touchSelectionDelay,
        class: className,
        style,
        onselect,
        onclick,
        ondblclick,
        onhover,
        decoration,
        ...rest
    }: HighlighterProps<T> = $props();

    // `highlights` is read as given, never wrapped in state of its own: the
    // segments hold the caller's objects, and when the caller keeps them in
    // `$state`, changes made in place are read here and re-render.
    const segments = $derived(computeSegments(text, highlights));
    const options: RenderOptions = $derived({
        strategy,
        overlap,
        focusable,
        defaultColor,
        brush,
    });
    const rootSpec = $derived(rootAttributes(options));
    // Everything the segments render from: a new value means a patch.
    const view = $derived({ text, segments, options, decoration });

    // Not state: nothing renders from these.
    let root: HTMLDivElement;
    // The text and segments the DOM shows: events between a prop change and
    // its flush must describe what the user sees, not what is about to render.
    let shown: { text: string; segments: readonly Segment<T>[] } = {
        text: '',
        segments: [],
    };
    let saved: ViewState | null = null;

    // Both read `view`, so both run in every flush that patches the
    // segments, before core's mutation observer re-checks the hovered
    // segment: `$effect.pre` before the template effects patch them,
    // `$effect` after.
    $effect.pre(() => {
        void view;
        if (root) saved = captureViewState(root);
    });
    $effect(() => {
        shown = { text: view.text, segments: view.segments };
        if (saved) restoreViewState(root, saved);
        saved = null;
    });

    onMount(() =>
        attachInteractions<T>(root, {
            getText: () => shown.text,
            getSegments: () => shown.segments,
            get minSelectionLength() {
                return minSelectionLength;
            },
            get touchSelectionDelay() {
                return touchSelectionDelay;
            },
            onSelect: (detail) => onselect?.(detail),
            onClick: (detail) => onclick?.(detail),
            onDblclick: (detail) => ondblclick?.(detail),
            onHover: (detail) => onhover?.(detail),
        }),
    );
</script>

<!--
    The elements of one segment from element `i` inward: each holds the next
    (the innermost holds the text), then the decoration if `target` puts it
    there. No whitespace between the tags and blocks: it would be text in the
    segment, shifting every offset after it. Hand-formatted for that reason.
-->
<!-- prettier-ignore -->
{#snippet layer(segment: Segment<T>, specs: ElementSpec[], target: DecorationTarget | null, i: number)}<svelte:element
    this={specs[i].tag}
    {...attributesOf(specs[i])}
>{#if i + 1 < specs.length}{@render layer(segment, specs, target, i + 1)}{:else}{segment.text}{/if}{#if decoration && target?.index === i}<svelte:element
    this={target.container.tag}
    {...attributesOf(target.container)}
>{@render decoration(segment)}</svelte:element>{/if}</svelte:element>{/snippet}

<div
    {...rest}
    {...rootSpec.attrs}
    style={rootStyleOf(style, rootSpec.style)}
    bind:this={root}
    class={className
        ? `${rootSpec.className} ${className}`
        : rootSpec.className}
>
    <!-- A segment whose covering ids change gets a new element, so a hover
         target is never patched into a different segment. -->
    {#each segments as segment (segmentKey(segment))}
        {@const specs = segmentElements(segment, options)}
        {@render layer(segment, specs, decorationTarget(segment, specs), 0)}
    {/each}
</div>
