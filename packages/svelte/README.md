# @overlapmark/svelte

Svelte 5 component for overlapmark: render overlapping text highlights and listen to selections, clicks and hovers. Built on [`@overlapmark/core`](https://www.npmjs.com/package/@overlapmark/core); renders the same DOM as [`@overlapmark/dom`](https://www.npmjs.com/package/@overlapmark/dom). Overlapping highlights get darker, and a click reports every highlight covering that spot: see the [overlapmark README](https://github.com/edonghyun/overlapmark#readme) and the **[live demo](https://edonghyun.github.io/overlapmark/)**.

```sh
npm install @overlapmark/svelte @overlapmark/core
```

Requires Svelte 5. The package ships `Highlighter.svelte` as source, compiled by your Svelte. The tests run on Svelte 5.57; on Svelte 5.0.5 the types are checked and the core scenarios run, with esrap pinned to 1.2.3 (npm `overrides`, pnpm `pnpm.overrides`): Svelte 5.0.5 accepts any esrap 1.x, and esrap 1.4 or later (as of October 2026) fails to compile TypeScript in any component (`Not implemented type annotation EmptyStatement`). Releases between 5.0.5 and 5.57 are not tested; pin esrap if you see that error. Install `@overlapmark/core` next to it: you import its stylesheet and types yourself.

```svelte
<script lang="ts">
    import '@overlapmark/core/styles.css';
    import type { Highlight, SelectDetail } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';

    const text = 'Overlapping highlights get darker where they overlap.';
    let highlights = $state<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
    const add = ({ start, end }: SelectDetail) =>
        highlights.push({ id: crypto.randomUUID(), start, end });
</script>

<Highlighter {text} {highlights} onselect={add} />
```

## More

A class on the root, and handlers for clicks:

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

| Prop                  | Type                                              | Default      | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                                          | required     | The source text. Positions are UTF-16 indices.                                                                                                          |
| `highlights`          | `Highlight<T>[]`                                  | `[]`         | `{ id, start, end, color?, className?, data? }`; `end` is exclusive; ids unique and without whitespace                                                  |
| `strategy`            | `'layers' \| 'depth'`                             | `'layers'`   | How overlaps are drawn                                                                                                                                  |
| `overlap`             | `'multiply' \| 'darken' \| 'none'`                | `'multiply'` | How nested layers combine with `layers` ([overlap modes](https://github.com/edonghyun/overlapmark#overlap-modes)); the `depth` strategy ignores it      |
| `focusable`           | `boolean`                                         | `true`       | Put `tabindex="0"` and `role="button"` on highlighted segments; Enter/Space calls `onclick`                                                             |
| `describe`            | `(highlights: readonly Highlight<T>[]) => string` | count        | The accessible description of a focusable segment, from the highlights covering it: `'1 highlight'` / `` `${n} highlights` `` by default; `''` for none |
| `defaultColor`        | `string`                                          | `#ddd6ff`    | Color of highlights without `color`: baked into their `--om-brush`, and, when given, set as `--om-default-color` on the root                            |
| `brush`               | `(color: string) => string`                       | built-in     | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                                                  |
| `minSelectionLength`  | `number`                                          | `1`          | Shorter selections do not call `onselect`                                                                                                               |
| `touchSelectionDelay` | `number`                                          | `500`        | Milliseconds of no selection change before `onselect` fires on touch; a change applies from the next selection change                                   |
| `decoration`          | `Snippet<[Segment]>`                              | none         | Decoration for each highlighted segment; see [Decorations](#decorations)                                                                                |

The component renders a single `<div class="om-root">`. `class` (a string) is added after `om-root`, and the other attributes you put on `<Highlighter>`, DOM event handlers such as `onpointerdown` included, land on that `div`. The root's own `data-om-strategy` (from `strategy`) and `data-om-overlap` (from `overlap`) always win over ones you pass. `Highlighter` is generic over the `data` of your highlights: given `Highlight<Note>[]`, the callbacks receive `Highlight<Note>` objects. The props types are exported as `HighlighterProps` and `HighlighterOwnProps`.

`highlights` may be a plain array or Svelte state, and the component never wraps it in state of its own. Changes made in place to a `$state` array (`push`, `splice`, a new `end` on a highlight) re-render. Events report the highlight objects as you read them from what you passed: your own objects for a plain or `$state.raw` array, and, for a deep `$state` array, the same state proxies `highlights[i]` gives you, so `detail.highlights[0] === highlights[0]` holds either way. Svelte wraps each object you put in deep `$state` in a proxy, so if you need the original objects back (`=== myHighlight`), hold the list in `$state.raw` and replace the array (`highlights = [...highlights, added]`). Passing a new array of the same highlights, as a re-rendering parent often does, leaves the DOM untouched: the selection and the hovered segment stay as they are.

## Callback props

| Prop                     | Detail                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onselect`               | `{ start, end, text, rect, highlights }` (highlights overlapping the selection; `rect` bounds the selected text inside the root, clipped to it, in the root's window viewport) |
| `onclick` / `ondblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`)                                                                    |
| `onhover`                | `{ type: 'enter' \| 'leave', segment, highlights, event }`; mouse pointers only (not touch or pen)                                                                             |

They receive core's detail objects (`SelectDetail`, `PointDetail`, `HoverDetail` from `@overlapmark/core`), not DOM events: `onclick` and `ondblclick` are the component's, not the `div`'s. Their timing is the same as in [`@overlapmark/dom`](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#events). Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, removing the component (`unmount`, or an `{#if}` turning false) and an update that removes the hovered highlight from under the mouse also call `onhover` with its `leave`, with `event: null`. On removal, Svelte has already taken the component's elements out of the document when that `leave` arrives.

## What an update keeps

When props change, the component re-renders and keeps the user's selection and keyboard focus by the same rules as `@overlapmark/dom`'s `update()` (see [What `update()` keeps](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#what-update-keeps)): the selection stays at the same text offsets unless the text changed, and focus returns to the same segment or to the highlighted segment now covering it. Both are restored in the same flush as the DOM patch.

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

The component renders the same markup on the server (`render` from `svelte/server`) as on the client and hydrates on it; events work once it is hydrated. Svelte's hydration does not detect content mismatches: it neither reports nor repairs server markup that differs from the client render. Pass the same props on the server and the client. Import `@overlapmark/core/styles.css` yourself; the component injects no CSS.

## Styling and accessibility

The shipped stylesheet has three levels of control: CSS variables (`--om-default-color` `#ddd6ff`, `--om-alpha` `55%`, `--om-depth-step` `12%`, `--om-depth-ink` `black`, `--om-max-depth` `6`), a `color` and `className` per highlight (presets `om-style-marker`, `om-style-underline`, `om-style-box`), and decorations (above). The classes, attributes and CSS variables you can style are listed in the [DOM contract](https://github.com/edonghyun/overlapmark/tree/main/packages/core#dom-contract), and the [styling guide](https://github.com/edonghyun/overlapmark#styling) shows each level.

With `focusable` on (the default), every highlighted segment is a Tab stop, announced as a button with its text and the `describe` description ("2 highlights"); Enter or Space calls `onclick`. For densely annotated text, set `focusable` to `false`. See [Accessibility](https://github.com/edonghyun/overlapmark#accessibility).

## Known limitations

- The full tests run on Svelte 5.57; on Svelte 5.0.5 an app type-checks and runs the core scenarios (select, click, keyboard activation, update) in Chromium, with esrap pinned to 1.2.3. Releases between them are not tested.
- Every highlighted segment gets a decoration container when a `decoration` snippet is given (see [Decorations](#decorations)).
- Hydration does not detect mismatches: pass the same props on the server and the client.
- ES modules only.

The [overlapmark README](https://github.com/edonghyun/overlapmark#readme) has the overlap modes, browser support (`color-mix()` is required), shadow DOM and iframes, dev warnings and all [known limitations](https://github.com/edonghyun/overlapmark#known-limitations).

## License

MIT
