# @overlapmark/vue

Vue 3 component for overlapmark: render overlapping text highlights and listen to selections, clicks and hovers. Built on [`@overlapmark/core`](../core); renders the same DOM as [`@overlapmark/dom`](../dom).

```sh
npm install @overlapmark/vue @overlapmark/core
```

Requires Vue 3.3 or later.

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

| Prop                  | Type                        | Default    | Description                                                                                                                  |
| --------------------- | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                    | required   | The source text. Positions are UTF-16 indices.                                                                               |
| `highlights`          | `Highlight[]`               | `[]`       | `{ id, start, end, color?, className?, data? }`; `end` is exclusive                                                          |
| `strategy`            | `'layers' \| 'depth'`       | `'layers'` | How overlaps are drawn                                                                                                       |
| `focusable`           | `boolean`                   | `true`     | Put `tabindex="0"` on highlighted segments; Enter/Space emits `click`                                                        |
| `defaultColor`        | `string`                    | `#ddd6ff`  | Color baked into the `--om-brush` image for highlights without `color`; for flat backgrounds set `--om-default-color` in CSS |
| `brush`               | `(color: string) => string` | built-in   | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                       |
| `minSelectionLength`  | `number`                    | `1`        | Shorter selections do not emit `select`                                                                                      |
| `touchSelectionDelay` | `number`                    | `500`      | Milliseconds of no selection change before `select` fires on touch; a change applies from the next selection change          |

The component renders a single `<div class="om-root">`. Classes and other attributes you put on `<Highlighter>` land on that `div`.

`highlights` may be plain arrays or reactive state. Changes made in place (`push`, `splice`, a new `end` on a highlight in a deep `ref`) re-render, and events always report your own highlight objects, never Vue's reactive proxies, so `detail.highlights[0] === myHighlight` holds. Passing a new array of the same highlights, as a re-rendering parent often does, leaves the DOM untouched: the selection and the hovered segment stay as they are.

For large lists, hold the highlights in a `shallowRef` and replace the array (`list.value = [...list.value, added]`) instead of a deep `ref`: a deep `ref` wraps every highlight in a proxy that the component reads through on each render, and in-place changes are the only thing it buys.

## Events

| Event                | Detail                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `select`             | `{ start, end, text, rect, highlights }` (highlights overlapping the selection)                             |
| `click` / `dblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`) |
| `hover`              | `{ type: 'enter' \| 'leave', segment, highlights, event }`; desktop mouse only                              |

The detail types (`SelectDetail`, `PointDetail`, `HoverDetail`) come from `@overlapmark/core`; their timing is the same as in [`@overlapmark/dom`](../dom#events). Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, unmounting the component, `<KeepAlive>` deactivating it, and an update that removes the hovered highlight from under the mouse also emit its `leave`, with `event: null`.

## What an update keeps

When props change, the component re-renders and keeps the user's selection and keyboard focus by the same rules as `@overlapmark/dom`'s `update()` (see [What `update()` keeps](../dom#what-update-keeps)): the selection stays at the same text offsets unless the text changed, and focus returns to the same segment or to the highlighted segment now covering it. Both are restored in the same flush as the DOM patch.

## Decorations

The `decoration` scoped slot (`{ segment }`) is the full-control styling tier: render presentational content, such as a count or an icon, for each highlighted segment.

```vue
<Highlighter :text="text" :highlights="highlights">
    <template #decoration="{ segment }">
        <sup v-if="segment.depth > 1">×{{ segment.depth }}</sup>
    </template>
</Highlighter>
```

The slot content goes in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element (right after its text). It never shifts the offsets `select` and `click` report, the shipped stylesheet keeps it out of selections and copies, and it is hidden from assistive technology, so it must not contain buttons, links or other focusable content. A segment the slot renders nothing for (as with `v-if` above) gets no container. Plain segments are not decorated.

## Server-side rendering

The component renders the same markup on the server (`renderToString`) as on the client and hydrates without mismatches; events work once it is hydrated. Import `@overlapmark/core/styles.css` yourself; the component injects no CSS.

See [`@overlapmark/dom`](../dom#dom-contract) for the DOM contract: the classes, attributes and CSS variables you can style.
