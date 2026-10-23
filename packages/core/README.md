# @overlapmark/core

Framework-agnostic core of [overlapmark](https://github.com/edonghyun/overlapmark#readme): segment computation, text search, the types and event details, DOM offset helpers and the default stylesheet. Overlapping highlights get darker, and a click reports every highlight covering that spot. **[Live demo](https://edonghyun.github.io/overlapmark/)** · **[Docs](https://edonghyun.github.io/overlapmark/docs/)**

Most apps want [`@overlapmark/dom`](https://www.npmjs.com/package/@overlapmark/dom) or a framework adapter ([`@overlapmark/vue`](https://www.npmjs.com/package/@overlapmark/vue), [`@overlapmark/react`](https://www.npmjs.com/package/@overlapmark/react), [`@overlapmark/svelte`](https://www.npmjs.com/package/@overlapmark/svelte)) and install this package next to it for the stylesheet and the types.

```sh
npm install @overlapmark/core
```

```ts
import '@overlapmark/core/styles.css';
import { computeSegments, findMatches } from '@overlapmark/core';
import type { Highlight } from '@overlapmark/core';

const text = 'Overlapping highlights get darker where they overlap.';
const highlights: Highlight[] = findMatches(text, ['overlap', 'darker']).map(
    (m, i) => ({ id: `m${i}`, ...m }),
);

for (const segment of computeSegments(text, highlights))
    console.log(JSON.stringify(segment.text), segment.depth);
```

CSS is a plain file; the JS never injects styles. Skip the import to style everything yourself. The main entry reads no `window` or `document`, so it runs on the server; `@overlapmark/core/dom` is browser-only.

Positions are UTF-16 string indices; `start` is inclusive, `end` exclusive. Segments never split a surrogate pair. A highlight is `{ id, start, end, color?, className?, data? }`. Ids must be unique and must not contain whitespace: `data-om-ids` is space-separated, and core warns once in development when an id is duplicated or contains whitespace. The [root README](https://github.com/edonghyun/overlapmark#highlights) lists every range rule and [dev warning](https://github.com/edonghyun/overlapmark#dev-warnings).

## `@overlapmark/core`

| Export                                    | Description                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computeSegments(text, highlights)`       | Flatten overlapping highlights into `Segment[]` (`{ start, end, text, highlights, depth }`). Non-integer, empty and reversed ranges are dropped and out-of-range ones clamped, each with a dev warning. |
| `segmentAt(segments, offset)`             | The segment containing an offset                                                                                                                                                                        |
| `highlightsInRange(segments, start, end)` | Highlights overlapping a range                                                                                                                                                                          |
| `findMatches(text, query, options?)`      | Literal search; `query` is a string or array. Options: `caseSensitive` (false), `overlapping` (true), `wholeWord` (false). Returns `{ start, end }[]`.                                                  |
| `DEFAULT_COLOR`, `defaultBrush(color)`    | Default color `#ddd6ff` and the default marker brush                                                                                                                                                    |
| Types                                     | `Highlight`, `Segment`, `Strategy`, `Overlap`, `RenderOptions`, `FindMatchesOptions`, `SelectDetail`, `PointDetail`, `HoverDetail`                                                                      |

`RenderOptions`, which every adapter takes as options or props:

| Option         | Type                                              | Default      | Description                                                                                                                                                                              |
| -------------- | ------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strategy`     | `'layers' \| 'depth'`                             | `'layers'`   | `layers`: one nested `<mark>` per highlight. `depth`: one per segment, darkened by its overlap count                                                                                     |
| `overlap`      | `'multiply' \| 'darken' \| 'none'`                | `'multiply'` | How nested layers combine with `layers` ([overlap modes](https://github.com/edonghyun/overlapmark#overlap-modes)); the `depth` strategy ignores it. Set on the root as `data-om-overlap` |
| `focusable`    | `boolean`                                         | `true`       | A highlighted segment gets `tabindex="0"`, `role="button"` and an `aria-description`; with `false`, none of them                                                                         |
| `describe`     | `(highlights: readonly Highlight<T>[]) => string` | count        | The `aria-description` of a focusable segment: `'1 highlight'` / `` `${n} highlights` `` by default; `''` for none                                                                       |
| `defaultColor` | `string`                                          | `#ddd6ff`    | Color of highlights without `color`: baked into their `--om-brush`, and, when given, set as `--om-default-color` on the root                                                             |
| `brush`        | `(color: string) => string`                       | built-in     | A CSS image value for `--om-brush` (used by `om-style-marker`)                                                                                                                           |

`SelectDetail.rect` is the bounding rect of the selected text inside the root, clipped to the root, in the viewport of the root's own window.

## `@overlapmark/core/dom`

Browser-only helpers.

| Export                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSelectionOffsets(root, selection?)`      | Current selection (defaults to the selection of `root`'s window) as `{ start, end }` in source-text indices clipped to `root`, or `null`                                                                                                                                                                                                                                                                                                                                                                                                                |
| `getOffsetFromPoint(root, clientX, clientY)` | Source-text index of the character under a viewport point, or `null` outside `root`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `createRangeFromOffsets(root, start, end)`   | A DOM `Range` for source-text indices (clamped), or `null` if `start > end`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `getTextLength(root)`                        | Length of the rendered source text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `attachInteractions(root, options)`          | Wire up `onSelect`/`onClick`/`onDblclick`/`onHover`; `options` also needs `getText()` and `getSegments()` and accepts `minSelectionLength` (1) and `touchSelectionDelay` (500). `options` is read live (mutate it or use getters instead of re-attaching). Returns a detach function. A hover `leave` with `event: null` is emitted on detach while a segment is hovered, and when a re-render leaves a different segment (other `start` or highlight ids) under the mouse; a segment re-rendered unchanged stays hovered.                              |
| `captureViewState(root)`                     | Records the selection, the focused segment and (when either is inside `root`) the rendered text, before a re-render; the result is opaque                                                                                                                                                                                                                                                                                                                                                                                                               |
| `restoreViewState(root, state)`              | Puts them back after the re-render. The text counts as changed when the rendered text differs from the captured one. Selection: restored at the same offsets (left as is when already there), cleared when the text changed. Focus: on the segment now covering the start of the focused one if it is highlighted and focusable; when the text changed, only a segment starting at that same offset qualifies; otherwise focus leaves `root`. Selections and focus outside `root` are left alone. Call both in the same synchronous flush as the patch. |
| Types                                        | `TextRange`, `InteractionOptions`, `ViewState`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

The root may be inside an open shadow root or an iframe: everything is read from the root's own tree and window. See [Shadow DOM and iframes](https://github.com/edonghyun/overlapmark#shadow-dom-and-iframes) for the limits.

## DOM contract

What every adapter renders, and what you can style:

| Kind         | Name                                                    | Meaning                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Class        | `om-root`                                               | The root element                                                                                                                                                                                             |
| Class        | `om-seg`                                                | Outermost element of a segment (a `<span>` for plain text, the outermost `<mark>` for highlighted text)                                                                                                      |
| Class        | `om-hl`                                                 | A highlight element (a `<mark>`)                                                                                                                                                                             |
| Class        | `om-style-marker`, `om-style-underline`, `om-style-box` | Presets, applied through `highlight.className`                                                                                                                                                               |
| Attribute    | `data-om-strategy`                                      | On the root: `layers` or `depth`                                                                                                                                                                             |
| Attribute    | `data-om-overlap`                                       | On the root: `multiply`, `darken` or `none`, always present                                                                                                                                                  |
| Attribute    | `data-om-start`                                         | On every `om-seg`: the segment's start index. Plain segments carry only this                                                                                                                                 |
| Attribute    | `data-om-depth`                                         | On a highlighted `om-seg`: the number of highlights covering it                                                                                                                                              |
| Attribute    | `data-om-ids`                                           | On a highlighted `om-seg`: the space-separated ids of the covering highlights, so `[data-om-ids~="x"]` matches                                                                                               |
| Attribute    | `data-om-id`                                            | On each layers-strategy `om-hl`: that highlight's id                                                                                                                                                         |
| Attribute    | `tabindex`                                              | On a focusable highlighted `om-seg`: `0`, or `om-lifted` (unfocusable) while a left mouse press on it is down                                                                                                |
| Attribute    | `role`, `aria-description`                              | On a focusable highlighted `om-seg`: `button`, and what `describe` returns; the description is an attribute, so it is never part of the text, a selection or the offsets                                     |
| Attribute    | `data-om-skip`                                          | Decoration container (`<span data-om-skip aria-hidden="true">`, after the innermost text of a highlighted segment); ignored when measuring offsets, `user-select: none` in `styles.css`; presentational only |
| CSS variable | `--om-color`                                            | Per highlight, from `highlight.color`; reset on every `.om-hl`                                                                                                                                               |
| CSS variable | `--om-brush`                                            | Per element, image used by `om-style-marker`                                                                                                                                                                 |
| CSS variable | `--om-level`, `--om-depth`                              | Layer index, 0 for the outermost (layers), and overlap count (depth)                                                                                                                                         |
| CSS variable | `--om-default-color`                                    | Theme: color for highlights without `color` (default `#ddd6ff`); when given, the `defaultColor` option sets it on the root                                                                                   |
| CSS variable | `--om-alpha`                                            | Theme: layer opacity (layers strategy, default `55%`)                                                                                                                                                        |
| CSS variable | `--om-depth-step`, `--om-max-depth`                     | Theme: darkening per level (default `12%`) and the level where it stops (default `6`), for the `darken` mode and the depth strategy                                                                          |
| CSS variable | `--om-depth-ink`                                        | Theme: the color the `darken` mode mixes toward (default `black`)                                                                                                                                            |

Set theme variables on `.om-root` or any ancestor; the stylesheet only reads them through `var()` fallbacks. Every rule in `styles.css` is wrapped in `:where()` (zero specificity), so your own class rules (for example from `highlight.className`) always win. Setting `--om-color` on the root has no effect, but setting it in a per-highlight class does.

`styles.css` needs `color-mix()` (Chrome and Edge 111, Firefox 113, Safari 16.2); see [Browser support](https://github.com/edonghyun/overlapmark#browser-support).

## Adapter authors: `@overlapmark/core/adapter` (unstable, may change in minor versions)

The helpers the framework adapters are built on. Applications do not need them, and they may change in any minor release.

| Export                                | Description                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `segmentElements(segment, options?)`  | Element specs (`tag`, `className`, `attrs`, `style`) describing how a segment is rendered, outermost first                                                    |
| `segmentKey(segment)`                 | Key for a segment's element in a framework diff: unique within one render, changes when `start`, `end` or the covering highlight ids change                   |
| `rootAttributes(options?)`            | Class, attributes (`data-om-strategy`, `data-om-overlap`) and style (`--om-default-color`, only when `defaultColor` is given) for the root element            |
| `decorationTarget(segment, elements)` | Where a segment's decoration goes: `{ index, container }` (the innermost of `elements`, and the `data-om-skip` container spec), or `null` for a plain segment |
| `compareHighlights(a, b, indexOf)`    | The ordering used everywhere: `start` ascending, longer first, then input order (`indexOf(h)` returns a highlight's input index)                              |
| Types                                 | `ElementSpec`, `DecorationTarget`, `InteractionHandlers`                                                                                                      |

## More

The [overlapmark README](https://github.com/edonghyun/overlapmark#readme) has the overlap modes, styling, events, accessibility, browser support and known limitations.

## License

MIT
