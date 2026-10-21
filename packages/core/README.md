# @overlapmark/core

Framework-agnostic core of overlapmark: segment computation, text search, the render contract, DOM offset helpers and the default stylesheet. Most apps want [`@overlapmark/dom`](../dom) (or a framework adapter, coming soon) instead of using this directly.

```sh
npm install @overlapmark/core
```

```ts
import '@overlapmark/core/styles.css';
```

CSS is a plain file; the JS never injects styles. Skip the import to style everything yourself.

Positions are UTF-16 string indices; `start` is inclusive, `end` exclusive. Segments never split a surrogate pair.

## `@overlapmark/core`

| Export                                    | Description                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computeSegments(text, highlights)`       | Flatten overlapping highlights into `Segment[]` (`{ start, end, text, highlights, depth }`). Invalid or stale ranges are handled deterministically.           |
| `compareHighlights(a, b)`                 | The ordering used everywhere: `start` ascending, longer first, then input order                                                                               |
| `segmentAt(segments, offset)`             | The segment containing an offset                                                                                                                              |
| `highlightsInRange(segments, start, end)` | Highlights overlapping a range                                                                                                                                |
| `findMatches(text, query, options?)`      | Literal search; `query` is a string or array. Options: `caseSensitive` (false), `overlapping` (true), `wholeWord` (false). Returns `{ start, end }[]`.        |
| `segmentElements(segment, options?)`      | Element specs (`tag`, `className`, `attrs`, `style`) describing how a segment is rendered; used by adapters                                                   |
| `rootAttributes(options?)`                | Class and attributes for the root element                                                                                                                     |
| `DEFAULT_COLOR`, `defaultBrush(color)`    | Default color `#ddd6ff` and the default marker brush                                                                                                          |
| Types                                     | `Highlight`, `Segment`, `Strategy`, `RenderOptions`, `ElementSpec`, `FindMatchesOptions`, `SelectDetail`, `PointDetail`, `HoverDetail`, `InteractionHandlers` |

`RenderOptions`: `strategy` (`'layers' | 'depth'`), `focusable`, `defaultColor`, `brush`.

## `@overlapmark/core/dom`

Browser-only helpers.

| Export                                       | Description                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSelectionOffsets(root, selection?)`      | Current selection (defaults to `window.getSelection()`) as `{ start, end }` in source-text indices clipped to `root`, or `null`                                                                            |
| `getOffsetFromPoint(root, clientX, clientY)` | Source-text index of the character under a viewport point, or `null` outside `root`                                                                                                                        |
| `createRangeFromOffsets(root, start, end)`   | A DOM `Range` for source-text indices (clamped), or `null` if `start > end`                                                                                                                                |
| `getTextLength(root)`                        | Length of the rendered source text                                                                                                                                                                         |
| `attachInteractions(root, options)`          | Wire up `onSelect`/`onClick`/`onDblclick`/`onHover`; `options` also needs `getText()` and `getSegments()` and accepts `minSelectionLength` (1) and `touchSelectionDelay` (500). Returns a detach function. |

## DOM contract

| Kind         | Name                                                    | Meaning                                                         |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------- |
| Class        | `om-root`                                               | The root element                                                |
| Class        | `om-seg`                                                | Outermost element of a segment                                  |
| Class        | `om-hl`                                                 | A highlight element (a `<mark>`)                                |
| Class        | `om-style-marker`, `om-style-underline`, `om-style-box` | Presets, applied through `highlight.className`                  |
| Attribute    | `data-om-strategy`                                      | On the root: `layers` or `depth`                                |
| Attribute    | `data-om-start`                                         | On `om-seg`: the segment's start index                          |
| Attribute    | `data-depth`                                            | Number of highlights covering the segment                       |
| Attribute    | `data-ids`                                              | Comma-separated ids of the covering highlights                  |
| Attribute    | `data-id`                                               | On each layers-strategy `om-hl`: that highlight's id            |
| Attribute    | `data-om-skip`                                          | Marks decorations to ignore when measuring offsets              |
| CSS variable | `--om-color`                                            | Per highlight, from `highlight.color`; reset on every `.om-hl`  |
| CSS variable | `--om-brush`                                            | Per element, image used by `om-style-marker`                    |
| CSS variable | `--om-level`, `--om-depth`                              | Layer index (layers) and overlap count (depth)                  |
| CSS variable | `--om-default-color`                                    | Theme: color for highlights without `color` (default `#ddd6ff`) |
| CSS variable | `--om-depth-step`, `--om-max-depth`                     | Theme: darkening per level and its cap (depth strategy)         |
| CSS variable | `--om-alpha`                                            | Theme: layer opacity (layers strategy)                          |

Set theme variables on `.om-root` or any ancestor; the stylesheet only reads them through `var()` fallbacks. Every rule in `styles.css` is wrapped in `:where()` (zero specificity), so your own class rules (for example from `highlight.className`) always win. Setting `--om-color` on the root has no effect, but setting it in a per-highlight class does.
