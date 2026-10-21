---
'@overlapmark/core': minor
'@overlapmark/dom': minor
'@overlapmark/vue': minor
'@overlapmark/react': minor
'@overlapmark/svelte': minor
---

Framework adapters: `Highlighter` components for Vue 3 (`@overlapmark/vue`), React (`@overlapmark/react`) and Svelte 5 (`@overlapmark/svelte`). They render the same DOM as `@overlapmark/dom`, report the same events with core's detail objects, keep the selection and keyboard focus across updates, render on the server and hydrate, and support decorations through a scoped slot, a render prop and a snippet.

`@overlapmark/core` adds what the adapters share: `segmentKey` to key segment elements in a framework diff, `decorationTarget` for where a decoration goes, and `captureViewState`/`restoreViewState` in `@overlapmark/core/dom`, which keep the selection and focus across a re-render (a selection is cleared when the text changed). `styles.css` gives decoration containers `user-select: none`.

`@overlapmark/dom` adds the `decorate` option, presentational markup after each highlighted segment's text in `<span data-om-skip aria-hidden="true">`. The function `on()` returns now removes only its own subscription, even when the same function is subscribed again. `update()` keeps the selection and focus through core's view state helpers: when the text changed, it now clears the selection instead of restoring the same offsets over other characters, and focus moves only to a segment starting where the focused one did.
