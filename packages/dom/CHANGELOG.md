# @overlapmark/dom

## 0.1.0

### Minor Changes

- fa7509c: Initial release of overlapmark: overlapping text highlights for Vue 3, React, Svelte 5 and plain JS. The more highlights cover a spot, the darker it gets, even when every highlight has its own color, and a click, tap or Enter reports every highlight covering that spot. The text is rendered once and cut into segments, runs of text covered by the same set of highlights, so highlights stay aligned with the text however the layout wraps. Positions are JS string indices (UTF-16 code units, `end` exclusive).

    `@overlapmark/core` is the framework-agnostic part: segment computation, text search, the types and event details, DOM offset helpers in `@overlapmark/core/dom`, the shared render model and `segmentKey`/`decorationTarget` for adapter authors in `@overlapmark/core/adapter` (unstable; minor versions may change it), and the default stylesheet `styles.css`. The `overlap` option sets how overlaps look: `multiply` (default), `darken` or `none`. The `layers` and `depth` strategies draw overlaps, and `defaultColor` colors highlights without a `color`. Colors are validated (up to 64 characters), and ids must not contain whitespace; both are reported with a one-time development warning. Segments carry `data-om-ids` (space-separated), a focusable segment has `role="button"` and an `aria-description` (`describe` customizes its text, by default "1 highlight" or "n highlights"). `select` reports the selected range, and its `rect` is the bounding rect of the selected text inside the root, clipped to the root.

    `@overlapmark/dom` renders highlights into any element and returns a `Highlighter` with `update()`, `on()` and `destroy()`. It reports `select`, `click` and hover events with core's detail objects, keeps the selection and keyboard focus across updates (a selection is cleared when the text changed), and supports decorations through the `decorate` option.

    `@overlapmark/vue` (Vue 3.3 or later), `@overlapmark/react` (React 18 or later) and `@overlapmark/svelte` (Svelte 5) provide a `Highlighter` component each. They render the same DOM as `@overlapmark/dom`, report the same events with core's detail objects, render on the server and hydrate, and support decorations through a scoped slot, a render prop and a snippet.

### Patch Changes

- Updated dependencies [fa7509c]
    - @overlapmark/core@0.1.0
