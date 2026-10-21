---
'@overlapmark/core': patch
'@overlapmark/vue': patch
---

A mouse press at the start of a highlight now selects text in Chromium: dragging from a focusable highlight's first character used to select nothing. While a mouse press on a focusable segment is down, its `tabindex` holds `om-lifted`, which makes it unfocusable, and the old value comes back on release; an update that re-renders the segment during the press keeps what it rendered. A mouse press focuses a highlight when the button is released, if it made no selection, instead of when it goes down. This applies to every adapter.

The Vue `Highlighter`'s declared type now type-checks on the whole declared peer range, Vue 3.3 to 3.5; it used to fail to type-check on most of that range.
