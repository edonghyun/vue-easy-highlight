# overlapmark

Overlapping highlights, done right: the more highlights overlap, the darker the text gets, and a click tells you exactly which highlights cover that spot. A lightweight highlighter that works in any framework.

- Text is rendered once. Highlights are flattened into segments, so they stay aligned with the text however the layout wraps.
- Zero runtime dependencies. CSS ships as a single file you import yourself.
- Positions are plain JS string indices (UTF-16 code units, `end` exclusive), so `text.slice(start, end)` is the highlighted text.

## Packages

| Package                              | Description                                                                    | Status      |
| ------------------------------------ | ------------------------------------------------------------------------------ | ----------- |
| [`@overlapmark/core`](packages/core) | Segment computation, `findMatches`, render contract, DOM helpers, `styles.css` | available   |
| [`@overlapmark/dom`](packages/dom)   | Vanilla JS adapter: `createHighlighter`                                        | available   |
| `@overlapmark/vue`                   | Vue adapter                                                                    | coming soon |
| `@overlapmark/react`                 | React adapter                                                                  | coming soon |
| `@overlapmark/svelte`                | Svelte adapter                                                                 | coming soon |

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

Select text with the mouse, finger or Shift+Arrow keys and a new highlight is added. Overlapping parts show up denser. Clicking (or pressing Enter/Space on a focused highlight) reports every highlight covering that point.

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
3. **Full control (planned).** Render your own markup per segment and highlight through adapter render slots (Vue/Svelte slots, a React render prop, a vanilla render callback), for badges, tooltip triggers or custom components. This tier is not available yet in `@overlapmark/dom`; it is coming with the framework adapters.

**Unstyled usage.** Independently of the tiers above, you can skip `@overlapmark/core/styles.css` entirely and style the DOM contract yourself. The library never injects CSS.

Overlap strategies (`strategy` option): `layers` (default) stacks one element per highlight; `depth` renders one element per segment and darkens it with the overlap count.

## Events

| Event                | When                                                                                | Detail                                                     |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `select`             | A selection inside the root is finished                                             | `{ start, end, text, rect, highlights }`                   |
| `click` / `dblclick` | Click or tap with no active selection; Enter/Space on a focused highlight (`click`) | `{ offset, segment, highlights, event }`                   |
| `hover`              | Mouse enters or leaves a highlighted segment (desktop only)                         | `{ type: 'enter' \| 'leave', segment, highlights, event }` |

`select` fires one macrotask after `pointerup`/`keyup` (on touch, after `touchSelectionDelay` ms, default 500, without a selection change). On the keyboard, `keyup` confirms only once no modifier (Shift/Ctrl/Alt/Meta) is held, so a Shift+Arrow run emits a single `select` when Shift is released.

Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, a `leave` is also emitted when the adapter is destroyed (or unmounted) or re-renders the hovered segment while it is hovered; such a `leave` has `event: null`.

## Migrating from `vue-easy-highlight`

| `vue-easy-highlight` | overlapmark                                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| `textsToHighlight`   | compute ranges with `findMatches(text, queries)` and pass them as `highlights` |
| `higlightColor`      | `color` on each highlight, or `--om-default-color` for the default             |

The Vue adapter (`@overlapmark/vue`) is coming soon; until then use `@overlapmark/dom`.

## License

MIT
