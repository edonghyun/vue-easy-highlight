# @overlapmark/dom

Vanilla JS adapter for overlapmark: render overlapping text highlights into any element and listen to selections and clicks. Depends only on [`@overlapmark/core`](../core).

```sh
npm install @overlapmark/dom @overlapmark/core
```

```ts
import '@overlapmark/core/styles.css';
import { createHighlighter } from '@overlapmark/dom';

const hl = createHighlighter(document.getElementById('text')!, {
    text: 'Some text to highlight',
    highlights: [{ id: 'a', start: 5, end: 9 }],
});
```

## `createHighlighter(el, options)`

Replaces the content of `el` with the rendered text and returns a `Highlighter`.

| Option                | Type                        | Default    | Description                                                                                                                  |
| --------------------- | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                    | required   | The source text. Positions are UTF-16 indices.                                                                               |
| `highlights`          | `Highlight[]`               | `[]`       | `{ id, start, end, color?, className?, data? }`; `end` is exclusive                                                          |
| `strategy`            | `'layers' \| 'depth'`       | `'layers'` | How overlaps are drawn                                                                                                       |
| `focusable`           | `boolean`                   | `true`     | Put `tabindex="0"` on highlighted segments; Enter/Space emits `click`                                                        |
| `defaultColor`        | `string`                    | `#ddd6ff`  | Color baked into the `--om-brush` image for highlights without `color`; for flat backgrounds set `--om-default-color` in CSS |
| `brush`               | `(color: string) => string` | built-in   | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                       |
| `minSelectionLength`  | `number`                    | `1`        | Shorter selections do not emit `select`                                                                                      |
| `touchSelectionDelay` | `number`                    | `500`      | Milliseconds of no selection change before `select` fires on touch                                                           |

### Returned object

| Member            | Description                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `update(partial)` | Merge new options and re-render. An in-progress selection and keyboard focus are preserved. |
| `on(type, fn)`    | Subscribe to `select`, `click`, `dblclick` or `hover`. Returns an unsubscribe function.     |
| `getSegments()`   | The current `Segment[]` (`{ start, end, text, highlights, depth }`)                         |
| `destroy()`       | Remove listeners and restore the element to plain text                                      |

### Events

| Event                | Detail                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `select`             | `{ start, end, text, rect, highlights }` (highlights overlapping the selection)                             |
| `click` / `dblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`) |
| `hover`              | `{ type: 'enter' \| 'leave', segment, highlights, event }`; desktop mouse only                              |

`select` fires one macrotask after `pointerup`/`keyup`, or after `touchSelectionDelay` ms without a selection change on touch. Keyboard Shift+Arrow selections emit once per step. `highlights` in every event follow the library order: `start` ascending, then longer first, then input order.

## DOM contract

| Kind         | Name                                                                    | Meaning                                                              |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Class        | `om-root`                                                               | The root element                                                     |
| Class        | `om-seg`                                                                | Outermost element of a segment                                       |
| Class        | `om-hl`                                                                 | A highlight element (a `<mark>`)                                     |
| Class        | `om-style-marker`, `om-style-underline`, `om-style-box`                 | Presets, applied through `highlight.className`                       |
| Attribute    | `data-om-strategy`                                                      | On the root: `layers` or `depth`                                     |
| Attribute    | `data-om-start`                                                         | On `om-seg`: the segment's start index                               |
| Attribute    | `data-depth`                                                            | Number of highlights covering the segment                            |
| Attribute    | `data-ids`                                                              | Comma-separated ids of the covering highlights                       |
| Attribute    | `data-id`                                                               | On each layers-strategy `om-hl`: that highlight's id                 |
| Attribute    | `data-om-skip`                                                          | Reserved for decorations that must be ignored when measuring offsets |
| CSS variable | `--om-color`, `--om-brush`, `--om-level`, `--om-depth`                  | Set by the library per element                                       |
| CSS variable | `--om-default-color`, `--om-depth-step`, `--om-max-depth`, `--om-alpha` | Theme variables you can set on `.om-root` or an ancestor             |

Setting `--om-color` on the root has no effect (it is reset on each `.om-hl`); use `--om-default-color`.

Vue, React and Svelte adapters are coming soon.
