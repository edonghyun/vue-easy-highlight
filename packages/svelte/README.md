# @overlapmark/svelte

Svelte 5 component for overlapmark: render overlapping text highlights and listen to selections, clicks and hovers. Built on [`@overlapmark/core`](../core); renders the same DOM as [`@overlapmark/dom`](../dom).

```sh
npm install @overlapmark/svelte @overlapmark/core
```

Requires Svelte 5. The package ships `Highlighter.svelte` as source, compiled by your Svelte.

```svelte
<script lang="ts">
    import '@overlapmark/core/styles.css';
    import type { Highlight, SelectDetail } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';

    const text = 'Overlapping highlights get darker where they overlap.';
    let highlights = $state<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);

    function add({ start, end }: SelectDetail) {
        highlights.push({ id: crypto.randomUUID(), start, end });
    }
</script>

<Highlighter
    class="article"
    {text}
    {highlights}
    onselect={add}
    onclick={({ highlights }) => console.log(highlights.map((h) => h.id))}
/>
```

## Props

| Prop                  | Type                        | Default    | Description                                                                                                                  |
| --------------------- | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                    | required   | The source text. Positions are UTF-16 indices.                                                                               |
| `highlights`          | `Highlight[]`               | `[]`       | `{ id, start, end, color?, className?, data? }`; `end` is exclusive                                                          |
| `strategy`            | `'layers' \| 'depth'`       | `'layers'` | How overlaps are drawn                                                                                                       |
| `focusable`           | `boolean`                   | `true`     | Put `tabindex="0"` on highlighted segments; Enter/Space calls `onclick`                                                      |
| `defaultColor`        | `string`                    | `#ddd6ff`  | Color baked into the `--om-brush` image for highlights without `color`; for flat backgrounds set `--om-default-color` in CSS |
| `brush`               | `(color: string) => string` | built-in   | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                       |
| `minSelectionLength`  | `number`                    | `1`        | Shorter selections do not call `onselect`                                                                                    |
| `touchSelectionDelay` | `number`                    | `500`      | Milliseconds of no selection change before `onselect` fires on touch; a change applies from the next selection change        |
| `decoration`          | `Snippet<[Segment]>`        | none       | Decoration for each highlighted segment; see [Decorations](#decorations)                                                     |

The component renders a single `<div class="om-root">`. `class` (a string) is added after `om-root`, and the other attributes you put on `<Highlighter>`, DOM event handlers such as `onpointerdown` included, land on that `div`. The props types are exported as `HighlighterProps` and `HighlighterOwnProps`.

`highlights` may be a plain array or Svelte state, and the component never wraps it in state of its own. Changes made in place to a `$state` array (`push`, `splice`, a new `end` on a highlight) re-render. Events report the highlight objects as you read them from what you passed: your own objects for a plain or `$state.raw` array, and, for a deep `$state` array, the same state proxies `highlights[i]` gives you, so `detail.highlights[0] === highlights[0]` holds either way. Svelte wraps each object you put in deep `$state` in a proxy, so if you need the original objects back (`=== myHighlight`), hold the list in `$state.raw` and replace the array (`highlights = [...highlights, added]`). Passing a new array of the same highlights, as a re-rendering parent often does, leaves the DOM untouched: the selection and the hovered segment stay as they are.

## Callback props

| Prop                     | Detail                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `onselect`               | `{ start, end, text, rect, highlights }` (highlights overlapping the selection)                             |
| `onclick` / `ondblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`) |
| `onhover`                | `{ type: 'enter' \| 'leave', segment, highlights, event }`; desktop mouse only                              |

They receive core's detail objects (`SelectDetail`, `PointDetail`, `HoverDetail` from `@overlapmark/core`), not DOM events: `onclick` and `ondblclick` are the component's, not the `div`'s. Their timing is the same as in [`@overlapmark/dom`](../dom#events). Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, removing the component (`unmount`, or an `{#if}` turning false) and an update that removes the hovered highlight from under the mouse also call `onhover` with its `leave`, with `event: null`. On removal, Svelte has already taken the component's elements out of the document when that `leave` arrives.

## What an update keeps

When props change, the component re-renders and keeps the user's selection and keyboard focus by the same rules as `@overlapmark/dom`'s `update()` (see [What `update()` keeps](../dom#what-update-keeps)): the selection stays at the same text offsets unless the text changed, and focus returns to the same segment or to the highlighted segment now covering it. Both are restored in the same flush as the DOM patch.

## Decorations

The `decoration` snippet (`segment`) is the full-control styling tier: render presentational content, such as a count or an icon, for each highlighted segment.

```svelte
<Highlighter {text} {highlights}>
    {#snippet decoration(segment)}
        {#if segment.depth > 1}<sup>×{segment.depth}</sup>{/if}
    {/snippet}
</Highlighter>
```

The snippet renders in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element (right after its text). It never shifts the offsets `onselect` and `onclick` report, the shipped stylesheet keeps it out of selections and copies, and it is hidden from assistive technology, so it must not contain buttons, links or other focusable content. Every highlighted segment gets the container: what a snippet renders is only known once it rendered, so a segment the snippet renders nothing for (as with `{#if}` above) keeps an empty one, which takes no space. Plain segments are not decorated.

## Server-side rendering

The component renders the same markup on the server (`render` from `svelte/server`) as on the client and hydrates without mismatches; events work once it is hydrated. Import `@overlapmark/core/styles.css` yourself; the component injects no CSS.

See [`@overlapmark/dom`](../dom#dom-contract) for the DOM contract: the classes, attributes and CSS variables you can style.
