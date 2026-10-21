# overlapmark

Overlapping highlights, done right: the more highlights overlap, the darker the text gets, and a click tells you exactly which highlights cover that spot. A lightweight highlighter that works in any framework.

- Text is rendered once. Highlights are flattened into segments, so they stay aligned with the text however the layout wraps.
- Zero runtime dependencies. CSS ships as a single file you import yourself.
- Positions are plain JS string indices (UTF-16 code units, `end` exclusive), so `text.slice(start, end)` is the highlighted text.

## Packages

| Package                                  | Description                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| [`@overlapmark/core`](packages/core)     | Segment computation, `findMatches`, render contract, DOM helpers, `styles.css` |
| [`@overlapmark/dom`](packages/dom)       | Vanilla JS adapter: `createHighlighter`                                        |
| [`@overlapmark/vue`](packages/vue)       | Vue 3 component: `Highlighter`                                                 |
| [`@overlapmark/react`](packages/react)   | React component: `Highlighter`                                                 |
| [`@overlapmark/svelte`](packages/svelte) | Svelte 5 component: `Highlighter`                                              |

Every adapter renders the same DOM from `@overlapmark/core` and reports the same events with the same detail objects. None of them injects CSS: import `@overlapmark/core/styles.css` yourself (or skip it and style the DOM contract).

## Quick start (vanilla JS)

```sh
npm install @overlapmark/dom @overlapmark/core
```

```html
<p id="text"></p>
```

```ts
import '@overlapmark/core/styles.css';
import { createHighlighter } from '@overlapmark/dom';

const text = 'Overlapping highlights get darker where they overlap.';
let highlights = [{ id: 'a', start: 0, end: 20 }];

const hl = createHighlighter(document.getElementById('text')!, {
    text,
    highlights,
});

hl.on('select', ({ start, end }) => {
    highlights = [...highlights, { id: crypto.randomUUID(), start, end }];
    hl.update({ highlights });
});
hl.on('click', ({ highlights: covering }) =>
    console.log(
        'covered by',
        covering.map((h) => h.id),
    ),
);
```

Select text with the mouse or a finger, or extend a selection with Shift+Arrow keys, and a new highlight is added. Overlapping parts show up denser. Clicking (or pressing Enter/Space on a focused highlight) reports every highlight covering that point.

To add highlights from a search instead of a selection:

```ts
import { findMatches } from '@overlapmark/core';

highlights = findMatches(text, 'highlights').map((m, i) => ({
    id: `m${i}`,
    ...m,
}));
hl.update({ highlights });
```

A runnable playground lives in [`examples/vanilla`](examples/vanilla): `pnpm --filter vanilla-example dev`.

## Quick start (Vue)

```sh
npm install @overlapmark/vue @overlapmark/core
```

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

Events are `@select`, `@click`, `@dblclick` and `@hover`, with the same detail objects as in vanilla JS; decorations go in the `decoration` scoped slot. See [`@overlapmark/vue`](packages/vue).

## Quick start (React)

```sh
npm install @overlapmark/react @overlapmark/core
```

```tsx
import '@overlapmark/core/styles.css';
import { useState } from 'react';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/react';

export function Article({ text }: { text: string }) {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const add = ({ start, end }: SelectDetail) =>
        setHighlights((list) => [
            ...list,
            { id: crypto.randomUUID(), start, end },
        ]);
    return <Highlighter text={text} highlights={highlights} onSelect={add} />;
}
```

Handlers are `onSelect`, `onClick`, `onDblClick` and `onHover`; they receive core's detail objects, not React events. Decorations come from the `renderDecoration` prop. See [`@overlapmark/react`](packages/react).

## Quick start (Svelte)

```sh
npm install @overlapmark/svelte @overlapmark/core
```

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

Callback props are `onselect`, `onclick`, `ondblclick` and `onhover`; they receive core's detail objects, not DOM events. Decorations come from the `decoration` snippet. See [`@overlapmark/svelte`](packages/svelte).

In every adapter, classes and other attributes you give the component land on its root `div`, after the `om-root` class; `om-root` and `data-om-strategy` (from `strategy`) always stay the component's own.

## Styling

Three levels, from least to most control:

1. **Theme with CSS variables.** Set them on `.om-root` or any ancestor, such as `:root` (values shown are the defaults; the stylesheet only uses them as `var()` fallbacks, so an ancestor value is never overridden).
    ```css
    :root {
        --om-default-color: #ddd6ff; /* color of highlights that have no `color` */
        --om-depth-step: 12%; /* how much darker per overlap level (depth strategy) */
        --om-max-depth: 6; /* depth at which darkening stops */
        --om-alpha: 55%; /* opacity of each layer (layers strategy) */
    }
    ```
    Note: `--om-color` is set per highlight from `highlight.color` and is reset on every `.om-hl`, so setting it on the root has no effect. Use `--om-default-color` instead.
2. **Per highlight.** Give a highlight a `color` and/or a `className`. Built-in presets: `om-style-marker`, `om-style-underline`, `om-style-box`.
    ```ts
    { id: 'note', start: 0, end: 12, color: '#ffd6d6', className: 'om-style-underline' }
    ```
    You can also write your own CSS against the DOM contract (`.om-hl`, `[data-depth]`, `[data-ids]`, `--om-level`); see the package README. Every library selector is wrapped in `:where()` (zero specificity), so a plain class rule such as `.memo { background-color: pink }` or `.memo { --om-color: pink }` wins regardless of stylesheet order.
3. **Decorations.** Add your own presentational markup after the text of each highlighted segment, such as an overlap count or an icon:
    - `@overlapmark/dom`: the `decorate: (segment) => Node | string | null` option
    - Vue: the `decoration` scoped slot (`{ segment }`)
    - React: the `renderDecoration: (segment) => ReactNode` prop
    - Svelte: the `decoration` snippet (`segment`)

    ```ts
    createHighlighter(el, {
        text,
        highlights,
        decorate: (segment) => (segment.depth > 1 ? `×${segment.depth}` : null),
    });
    ```

    A decoration goes in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element. It is presentational: it never shifts the offsets `select` and `click` report, the shipped stylesheet gives it `user-select: none` so it stays out of selections and copies, and `aria-hidden` hides it from assistive technology, so it must not contain buttons, links or other focusable content. Plain (unhighlighted) segments are not decorated, and a segment whose decoration renders nothing gets no container: `decorate` returning `null` or `''`, a Vue slot rendering only comments (such as `v-if`), empty text or an empty array, or `renderDecoration` returning `null`, `undefined`, a boolean, `''` or an empty array. Svelte is the exception: every highlighted segment gets a container (see [Known limitations](#known-limitations)).

**Unstyled usage.** Independently of the tiers above, you can skip `@overlapmark/core/styles.css` entirely and style the DOM contract yourself. The library never injects CSS.

Overlap strategies (`strategy` option): `layers` (default) stacks one element per highlight; `depth` renders one element per segment and darkens it with the overlap count.

## Events

| Event                | When                                                                                | Detail                                                     |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `select`             | A selection inside the root is finished                                             | `{ start, end, text, rect, highlights }`                   |
| `click` / `dblclick` | Click or tap with no active selection; Enter/Space on a focused highlight (`click`) | `{ offset, segment, highlights, event }`                   |
| `hover`              | Mouse enters or leaves a highlighted segment (desktop only)                         | `{ type: 'enter' \| 'leave', segment, highlights, event }` |

The names follow each framework: `on('select', fn)` in `@overlapmark/dom`, `@select` in Vue, `onSelect` in React (`onDblClick` for `dblclick`), `onselect` in Svelte. The detail types (`SelectDetail`, `PointDetail`, `HoverDetail`) come from `@overlapmark/core`.

`select` fires one macrotask after `pointerup`/`keyup` (on touch, after `touchSelectionDelay` ms, default 500, without a selection change). On the keyboard, `keyup` confirms only once no modifier (Shift/Ctrl/Alt/Meta) is held, so a Shift+Arrow run emits a single `select` when Shift is released. Shift+Arrow extends a selection the user already has; in Chrome and Safari, Shift+Arrow from a caret in static text selects nothing.

Touch is verified in the acceptance tests on emulated mobile profiles (Pixel 7 in Chromium, iPhone 15 in WebKit): a tap reports `click` with the covering highlights and no `hover`, in both. A long press that selects text, and the `select` that follows once the selection settles, is verified in Chromium only, with a real press-and-hold that the browser turns into a selection. Automation cannot hold a touch in WebKit, so there that gesture is not tested; nor are the selection handles you drag after a long press.

A mouse press on a focusable highlight focuses it when the button is released, if the press made no selection (a click), not when it goes down: Chrome would otherwise not start a drag selection on a highlight's first character.

Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, a `leave` is also emitted when the adapter is destroyed (or the component unmounted) and when an update removes the hovered highlight from under the mouse. Such a programmatic `leave` has no pointer event behind it, so its `event` is `null`. An update that re-renders the hovered segment unchanged (same `start` and highlight ids) emits nothing.

## Migrating from `vue-easy-highlight`

| `vue-easy-highlight` | overlapmark                                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| `textsToHighlight`   | compute ranges with `findMatches(text, queries)` and pass them as `highlights` |
| `higlightColor`      | `color` on each highlight, or `--om-default-color` for the default             |

In Vue, render `Highlighter` from [`@overlapmark/vue`](packages/vue) in place of the old component, with `text` and `highlights` props.

## Known limitations

- **Peer lower bounds get a reduced test.** `@overlapmark/react` declares React 18 or later, `@overlapmark/vue` Vue 3.3 or later and `@overlapmark/svelte` Svelte 5 or later. The full suites run on React 19, Vue 3.5 and Svelte 5.57. On React 18.3, Vue 3.3 and Svelte 5.0 an app type-checks against the published types and runs the core scenarios (select, click, keyboard activation, update) in Chromium; releases in between are not tested.
- **Svelte 5.0 needs an older esrap.** `Highlighter.svelte` ships as TypeScript source. Svelte 5.0 accepts any esrap 1.x, and a fresh install picks esrap 1.4, which fails to compile TypeScript in any component (`Not implemented type annotation EmptyStatement`). Pin esrap to 1.2.3 (npm `overrides`, pnpm `pnpm.overrides`), or use a later Svelte.
- **Verified browsers and devices.** Each app (vanilla, Vue, React and Svelte), installed from the packed tarballs, runs the full acceptance suite in Playwright's desktop Chromium, Firefox and WebKit and in its emulated Pixel 7 (Chromium) and iPhone 15 (WebKit) profiles, on Linux in CI. These are Playwright's engine builds and device emulation, not branded Chrome, Edge or Safari, and no real phone or tablet is tested. The packages' own browser tests run in Chromium only. A long press that selects text is verified in Chromium's mobile emulation only (see [Events](#events)).
- **Server rendering is verified on development builds.** The Vue, React and Svelte apps render on the server and hydrate in desktop Chromium, Firefox and WebKit with the frameworks' development builds, which report hydration mismatches. What their production builds do on a mismatch is not tested.
- **ESM only for the framework adapters.** `@overlapmark/vue`, `@overlapmark/react` and `@overlapmark/svelte` ship ES modules only; `@overlapmark/core` and `@overlapmark/dom` ship both ES modules and CommonJS.
- **Programmatic hover `leave`.** A `leave` caused by unmounting, destroying or an update, not by the mouse, carries `event: null`. Hiding the component also emits one for a hovered segment: React's `<Activity mode="hidden">` and Vue's `<KeepAlive>` deactivating it.
- **Vue `data` is untyped.** The Vue `Highlighter` is not generic over `Highlight<T>`, so `data` in its events and slot is `unknown`; cast it where you read it. The React and Svelte components are generic.
- **Svelte differences.**
    - When the component is removed while a segment is hovered, the `leave` still reaches `onhover`, but Svelte has already taken the root `div` out of the document by then.
    - Every highlighted segment gets a decoration container when a `decoration` snippet is given: what a snippet renders is only known once it rendered, so a segment it renders nothing for keeps an empty container (no text, takes no space). The other adapters render no container for a decoration that renders nothing (see [Styling](#styling), tier 3).
    - Highlights held in deep `$state` arrive in events as Svelte's state proxies (the same values `highlights[i]` gives you), not your original objects. Use `$state.raw` when you need `=== myHighlight`.
    - Svelte's hydration does not check the server markup against the client render, so a mismatch is neither reported nor repaired. Pass the same props on the server and the client.

## License

MIT
