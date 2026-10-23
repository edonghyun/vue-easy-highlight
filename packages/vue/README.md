# @overlapmark/vue

Vue 3 component for overlapmark: render overlapping text highlights and listen to selections, clicks and hovers. Built on [`@overlapmark/core`](https://www.npmjs.com/package/@overlapmark/core); renders the same DOM as [`@overlapmark/dom`](https://www.npmjs.com/package/@overlapmark/dom). Overlapping highlights get darker, and a click reports every highlight covering that spot: see the [overlapmark README](https://github.com/edonghyun/overlapmark#readme) the **[live demo](https://edonghyun.github.io/overlapmark/)** and the **[docs](https://edonghyun.github.io/overlapmark/docs/)**.

```sh
npm install @overlapmark/vue @overlapmark/core
```

Requires Vue 3.3 or later. The full tests run on Vue 3.5. The type declarations are also checked against Vue 3.3, 3.4, 3.5.0 and the latest 3.5, and on Vue 3.3 the core scenarios run in Chromium. Install `@overlapmark/core` next to it: you import its stylesheet and types yourself.

```vue
<script setup lang="ts">
import '@overlapmark/core/styles.css';
import { ref } from 'vue';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/vue';

const text = 'Overlapping highlights get darker where they overlap.';
const highlights = ref<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
const add = ({ start, end }: SelectDetail) =>
    highlights.value.push({ id: crypto.randomUUID(), start, end });
</script>

<template>
    <Highlighter :text="text" :highlights="highlights" @select="add" />
</template>
```

## More

A class on the root, and handlers for clicks:

```vue
<script setup lang="ts">
import '@overlapmark/core/styles.css';
import { ref } from 'vue';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/vue';

const text = 'Overlapping highlights get darker where they overlap.';
const highlights = ref<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);

function add({ start, end }: SelectDetail) {
    highlights.value.push({ id: crypto.randomUUID(), start, end });
}
</script>

<template>
    <Highlighter
        class="article"
        :text="text"
        :highlights="highlights"
        @select="add"
        @click="({ highlights }) => console.log(highlights.map((h) => h.id))"
    />
</template>
```

## Props

| Prop                  | Type                                              | Default      | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                                          | required     | The source text. Positions are UTF-16 indices.                                                                                                          |
| `highlights`          | `Highlight<T>[]`                                  | `[]`         | `{ id, start, end, color?, className?, data? }`; `end` is exclusive; ids unique and without whitespace                                                  |
| `strategy`            | `'layers' \| 'depth'`                             | `'layers'`   | How overlaps are drawn                                                                                                                                  |
| `overlap`             | `'multiply' \| 'darken' \| 'none'`                | `'multiply'` | How nested layers combine with `layers` ([overlap modes](https://github.com/edonghyun/overlapmark#overlap-modes)); the `depth` strategy ignores it      |
| `focusable`           | `boolean`                                         | `true`       | Put `tabindex="0"` and `role="button"` on highlighted segments; Enter/Space emits `click`                                                               |
| `describe`            | `(highlights: readonly Highlight<T>[]) => string` | count        | The accessible description of a focusable segment, from the highlights covering it: `'1 highlight'` / `` `${n} highlights` `` by default; `''` for none |
| `defaultColor`        | `string`                                          | `#ddd6ff`    | Color of highlights without `color`: baked into their `--om-brush`, and, when given, set as `--om-default-color` on the root                            |
| `brush`               | `(color: string) => string`                       | built-in     | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                                                  |
| `minSelectionLength`  | `number`                                          | `1`          | Shorter selections do not emit `select`                                                                                                                 |
| `touchSelectionDelay` | `number`                                          | `500`        | Milliseconds of no selection change before `select` fires on touch; a change applies from the next selection change                                     |

The component renders a single `<div class="om-root">`. Classes and other attributes you put on `<Highlighter>` land on that `div`, classes after `om-root`. The root's own `om-root` class, `data-om-strategy` (from `strategy`) and `data-om-overlap` (from `overlap`) always win: a value you pass for either attribute is replaced. The slots type is exported as `HighlighterSlots`.

`highlights` may be plain arrays or reactive state. Changes made in place (`push`, `splice`, a new `end` on a highlight in a deep `ref`) re-render, and events always report your own highlight objects, never Vue's reactive proxies, so `detail.highlights[0] === myHighlight` holds. Passing a new array of the same highlights, as a re-rendering parent often does, leaves the DOM untouched: the selection and the hovered segment stay as they are.

For large lists, hold the highlights in a `shallowRef` and replace the array (`list.value = [...list.value, added]`) instead of a deep `ref`: a deep `ref` wraps every highlight in a proxy that the component reads through on each render, and in-place changes are the only thing it buys.

## Events

| Event                | Detail                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `select`             | `{ start, end, text, rect, highlights }` (highlights overlapping the selection; `rect` bounds the selected text inside the root, clipped to it, in the root's window viewport) |
| `click` / `dblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`)                                                                    |
| `hover`              | `{ type: 'enter' \| 'leave', segment, highlights, event }`; mouse pointers only (not touch or pen)                                                                             |

`Highlighter` is generic over the `data` of your highlights: in a template, given `Highlight<Note>[]`, the event details, `describe` and the decoration slot's `segment` hold `Highlight<Note>` objects, as `vue-tsc` checks them. A render function names the type: `h(Highlighter<Note>, { ... })`.

The detail types (`SelectDetail`, `PointDetail`, `HoverDetail`) come from `@overlapmark/core`; their timing is the same as in [`@overlapmark/dom`](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#events). Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, unmounting the component, `<KeepAlive>` deactivating it, and an update that removes the hovered highlight from under the mouse also emit its `leave`, with `event: null`.

## What an update keeps

When props change, the component re-renders and keeps the user's selection and keyboard focus by the same rules as `@overlapmark/dom`'s `update()` (see [What `update()` keeps](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#what-update-keeps)): the selection stays at the same text offsets unless the text changed, and focus returns to the same segment or to the highlighted segment now covering it. Both are restored in the same flush as the DOM patch.

## Decorations

The `decoration` scoped slot (`{ segment }`) is the full-control styling tier: render presentational content, such as a count or an icon, for each highlighted segment.

```vue
<Highlighter :text="text" :highlights="highlights">
    <template #decoration="{ segment }">
        <sup v-if="segment.depth > 1">×{{ segment.depth }}</sup>
    </template>
</Highlighter>
```

The slot content goes in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element (right after its text). It never shifts the offsets `select` and `click` report, the shipped stylesheet keeps it out of selections and copies, and it is hidden from assistive technology, so it must not contain buttons, links or other focusable content. A segment the slot renders nothing for gets no container: only comments (`v-if` as above, or `null`, `undefined` or `false` from a render function), empty text or an empty array. Plain segments are not decorated.

## Server-side rendering

The component renders the same markup on the server (`renderToString`) as on the client and hydrates without mismatches; events work once it is hydrated. Import `@overlapmark/core/styles.css` yourself; the component injects no CSS.

## Styling and accessibility

The shipped stylesheet has three levels of control: CSS variables (`--om-default-color` `#ddd6ff`, `--om-alpha` `55%`, `--om-depth-step` `12%`, `--om-depth-ink` `black`, `--om-max-depth` `6`), a `color` and `className` per highlight (presets `om-style-marker`, `om-style-underline`, `om-style-box`), and decorations (above). The classes, attributes and CSS variables you can style are listed in the [DOM contract](https://github.com/edonghyun/overlapmark/tree/main/packages/core#dom-contract), and the [styling guide](https://github.com/edonghyun/overlapmark#styling) shows each level.

With `focusable` on (the default), every highlighted segment is a Tab stop, announced as a button with its text and the `describe` description ("2 highlights"); Enter or Space calls `@click`. For densely annotated text, set `focusable` to `false`. See [Accessibility](https://github.com/edonghyun/overlapmark#accessibility).

## Known limitations

- The full tests run on Vue 3.5. The type declarations are also checked against Vue 3.3, 3.4, 3.5.0 and the latest 3.5, and on Vue 3.3 an app runs the core scenarios (select, click, keyboard activation, update) in Chromium; other releases are not tested.
- A `decoration` slot whose `v-for` renders an empty list leaves an empty container (no text, takes no space).
- Server rendering is verified with Vue's development build, which reports hydration mismatches; what the production build does on a mismatch is not tested.
- ES modules only.

The [overlapmark README](https://github.com/edonghyun/overlapmark#readme) has the overlap modes, browser support (`color-mix()` is required), shadow DOM and iframes, dev warnings and all [known limitations](https://github.com/edonghyun/overlapmark#known-limitations).

## License

MIT
