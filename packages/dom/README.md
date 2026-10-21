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

Replaces the content of `el` with the rendered text and returns a `Highlighter`. It adds the `om-root` class to the classes `el` already has and sets `data-om-strategy` from `strategy`, replacing any value `el` had.

| Option                | Type                                  | Default    | Description                                                                                                                  |
| --------------------- | ------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                              | required   | The source text. Positions are UTF-16 indices.                                                                               |
| `highlights`          | `Highlight[]`                         | `[]`       | `{ id, start, end, color?, className?, data? }`; `end` is exclusive                                                          |
| `strategy`            | `'layers' \| 'depth'`                 | `'layers'` | How overlaps are drawn                                                                                                       |
| `focusable`           | `boolean`                             | `true`     | Put `tabindex="0"` on highlighted segments; Enter/Space emits `click`                                                        |
| `defaultColor`        | `string`                              | `#ddd6ff`  | Color baked into the `--om-brush` image for highlights without `color`; for flat backgrounds set `--om-default-color` in CSS |
| `brush`               | `(color: string) => string`           | built-in   | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                       |
| `minSelectionLength`  | `number`                              | `1`        | Shorter selections do not emit `select`                                                                                      |
| `touchSelectionDelay` | `number`                              | `500`      | Milliseconds of no selection change before `select` fires on touch                                                           |
| `decorate`            | `(segment) => Node \| string \| null` | none       | Decoration after each highlighted segment's text (see below); `null` or `''` for none                                        |

### Returned object

| Member            | Description                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update(partial)` | Merge new options and re-render, keeping the selection and keyboard focus (see below).                                                             |
| `on(type, fn)`    | Subscribe to `select`, `click`, `dblclick` or `hover`. Returns a function that removes this subscription only; every call is its own subscription. |
| `getSegments()`   | The current `Segment[]` (`{ start, end, text, highlights, depth }`)                                                                                |
| `destroy()`       | Remove listeners and restore the element to plain text                                                                                             |

### What `update()` keeps

- **Selection:** restored at the same text offsets, unless the re-render changed the text. Then the selection is cleared, since the same offsets would now select other characters. Whether the text changed is read from what is rendered, so passing an equal string again keeps the selection. Selections outside the element are never touched.
- **Focus:** a focused highlight gets focus back on its re-rendered element. If its segment is gone and the text is unchanged, focus moves to the segment now covering the start of the old one, when that segment is highlighted and focusable. Otherwise focus leaves the element and is not moved elsewhere; in particular a changed text never moves focus to another segment.

### Decorations

`decorate` is the full-control styling tier: return presentational markup, such as a count or an icon, for a highlighted segment. The result goes in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element (right after its text). It never shifts the offsets `select` and `click` report, the shipped stylesheet keeps it out of selections and copies (`user-select: none`), and it is hidden from assistive technology. Because it is `aria-hidden`, it must not contain interactive content such as buttons, links or other focusable elements. A click on a decoration is reported as a `click` on its segment, with `offset` at the segment's start. A segment `decorate` returns `null` or `''` for gets no container, and plain segments are not decorated. `decorate` runs on every render; return a new `Node` each time.

```ts
createHighlighter(el, {
    text,
    highlights,
    decorate: (segment) => (segment.depth > 1 ? `×${segment.depth}` : null),
});
```

### Events

| Event                | Detail                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `select`             | `{ start, end, text, rect, highlights }` (highlights overlapping the selection)                             |
| `click` / `dblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`) |
| `hover`              | `{ type: 'enter' \| 'leave', segment, highlights, event }`; desktop mouse only                              |

`select` fires one macrotask after `pointerup`/`keyup`, or after `touchSelectionDelay` ms without a selection change on touch. A `touchSelectionDelay` changed by `update()` applies from the next selection change; the re-render of `update()` is itself one, so a touch selection already waiting restarts its wait with the new delay. On the keyboard, `keyup` confirms only once no modifier (Shift/Ctrl/Alt/Meta) is held, so a Shift+Arrow run emits a single `select` when Shift is released. `highlights` in every event follow the library order: `start` ascending, then longer first, then input order.

Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, `destroy()` and an `update()` that removes the hovered highlight from under the mouse also emit its `leave`, with `event: null`. An `update()` that re-renders the hovered segment unchanged (same `start` and highlight ids) emits nothing.

## DOM contract

| Kind         | Name                                                                    | Meaning                                                                                 |
| ------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Class        | `om-root`                                                               | The root element                                                                        |
| Class        | `om-seg`                                                                | Outermost element of a segment                                                          |
| Class        | `om-hl`                                                                 | A highlight element (a `<mark>`)                                                        |
| Class        | `om-style-marker`, `om-style-underline`, `om-style-box`                 | Presets, applied through `highlight.className`                                          |
| Attribute    | `data-om-strategy`                                                      | On the root: `layers` or `depth`                                                        |
| Attribute    | `data-om-start`                                                         | On `om-seg`: the segment's start index                                                  |
| Attribute    | `data-depth`                                                            | Number of highlights covering the segment                                               |
| Attribute    | `data-ids`                                                              | Comma-separated ids of the covering highlights                                          |
| Attribute    | `data-id`                                                               | On each layers-strategy `om-hl`: that highlight's id                                    |
| Attribute    | `data-om-skip`                                                          | On the decoration container (with `aria-hidden="true"`): ignored when measuring offsets |
| CSS variable | `--om-color`, `--om-brush`, `--om-level`, `--om-depth`                  | Set by the library per element                                                          |
| CSS variable | `--om-default-color`, `--om-depth-step`, `--om-max-depth`, `--om-alpha` | Theme variables you can set on `.om-root` or an ancestor                                |

Setting `--om-color` on the root has no effect (it is reset on each `.om-hl`); use `--om-default-color`. All rules in `styles.css` have zero specificity (`:where()`), so your own class rules always win.

For Vue, React and Svelte, use [`@overlapmark/vue`](../vue), [`@overlapmark/react`](../react) and [`@overlapmark/svelte`](../svelte): they render this same DOM.
