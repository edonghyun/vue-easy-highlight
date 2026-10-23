# @overlapmark/dom

Vanilla JS adapter for [overlapmark](https://github.com/edonghyun/overlapmark#readme): render overlapping text highlights into any element and listen to selections and clicks. Overlapping highlights get darker, and a click reports every highlight covering that spot. Depends only on [`@overlapmark/core`](https://www.npmjs.com/package/@overlapmark/core). **[Live demo](https://edonghyun.github.io/overlapmark/)** · **[Docs](https://edonghyun.github.io/overlapmark/docs/)**

Install `@overlapmark/core` next to it: you import its stylesheet and types yourself.

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

## `createHighlighter(el, options)`

Replaces the content of `el` with the rendered text and returns a `Highlighter`. It adds the `om-root` class to the classes `el` already has and sets `data-om-strategy` and `data-om-overlap` (and `--om-default-color` when `defaultColor` is given), replacing any value `el` had; `destroy()` removes them again. `HighlighterOptions` and `Highlighter` are exported as types.

| Option                | Type                                              | Default      | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                                          | required     | The source text. Positions are UTF-16 indices.                                                                                                          |
| `highlights`          | `Highlight<T>[]`                                  | `[]`         | `{ id, start, end, color?, className?, data? }`; `end` is exclusive; ids unique and without whitespace                                                  |
| `strategy`            | `'layers' \| 'depth'`                             | `'layers'`   | How overlaps are drawn                                                                                                                                  |
| `overlap`             | `'multiply' \| 'darken' \| 'none'`                | `'multiply'` | How nested layers combine with `layers` ([overlap modes](https://github.com/edonghyun/overlapmark#overlap-modes)); the `depth` strategy ignores it      |
| `focusable`           | `boolean`                                         | `true`       | Put `tabindex="0"` and `role="button"` on highlighted segments; Enter/Space emits `click`                                                               |
| `describe`            | `(highlights: readonly Highlight<T>[]) => string` | count        | The accessible description of a focusable segment, from the highlights covering it: `'1 highlight'` / `` `${n} highlights` `` by default; `''` for none |
| `defaultColor`        | `string`                                          | `#ddd6ff`    | Color of highlights without `color`: baked into their `--om-brush`, and, when given, set as `--om-default-color` on the element                         |
| `brush`               | `(color: string) => string`                       | built-in     | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                                                  |
| `minSelectionLength`  | `number`                                          | `1`          | Shorter selections do not emit `select`                                                                                                                 |
| `touchSelectionDelay` | `number`                                          | `500`        | Milliseconds of no selection change before `select` fires on touch                                                                                      |
| `decorate`            | `(segment) => Node \| string \| null`             | none         | Decoration after each highlighted segment's text (see below); `null` or `''` for none                                                                   |

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

| Event                | Detail                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select`             | `{ start, end, text, rect, highlights }` (highlights overlapping the selection; `rect` bounds the selected text inside the element, in its window's viewport) |
| `click` / `dblclick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`)                                                   |
| `hover`              | `{ type: 'enter' \| 'leave', segment, highlights, event }`; mouse pointers only (not touch or pen)                                                            |

`select` fires on the next task after the mouse button or key is released, or after `touchSelectionDelay` ms without a selection change on touch. A `touchSelectionDelay` changed by `update()` applies from the next selection change; the re-render of `update()` is itself one, so a touch selection already waiting restarts its wait with the new delay. On the keyboard, `keyup` confirms only once no modifier (Shift/Ctrl/Alt/Meta) is held, so a Shift+Arrow run emits a single `select` when Shift is released. Shift+Arrow extends a selection the user already has; in Chrome and Safari, Shift+Arrow from a caret in static text selects nothing. A left mouse press on a focusable highlight focuses it on release when it made no selection (a click), not on press; pressing a highlight that already has focus briefly blurs it and focuses it again on release, and after a double-click the highlight does not keep focus. `highlights` in every event follow the library order: `start` ascending, then longer first, then input order.

Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, `destroy()` and an `update()` that removes the hovered highlight from under the mouse also emit its `leave`, with `event: null`. An `update()` that re-renders the hovered segment unchanged (same `start` and highlight ids) emits nothing.

`click` also fires on unhighlighted text, with `highlights: []`. The same selected range is not reported twice in a row: `select` fires again for it only after the selection was cleared or changed.

## Styling and accessibility

The shipped stylesheet has three levels of control: CSS variables (`--om-default-color` `#ddd6ff`, `--om-alpha` `55%`, `--om-depth-step` `12%`, `--om-depth-ink` `black`, `--om-max-depth` `6`), a `color` and `className` per highlight (presets `om-style-marker`, `om-style-underline`, `om-style-box`), and decorations (above). The classes, attributes and CSS variables you can style are listed in the [DOM contract](https://github.com/edonghyun/overlapmark/tree/main/packages/core#dom-contract), and the [styling guide](https://github.com/edonghyun/overlapmark#styling) shows each level.

With `focusable: true` (the default), every highlighted segment is a Tab stop, announced as a button with its text and the `describe` description ("2 highlights"); for densely annotated text, set `focusable: false`. See [Accessibility](https://github.com/edonghyun/overlapmark#accessibility).

## More

The [overlapmark README](https://github.com/edonghyun/overlapmark#readme) has the overlap modes, browser support (`color-mix()` is required), shadow DOM and iframes, dev warnings and [known limitations](https://github.com/edonghyun/overlapmark#known-limitations). For Vue, React and Svelte, use [`@overlapmark/vue`](https://www.npmjs.com/package/@overlapmark/vue), [`@overlapmark/react`](https://www.npmjs.com/package/@overlapmark/react) and [`@overlapmark/svelte`](https://www.npmjs.com/package/@overlapmark/svelte): they render this same DOM.

## License

MIT
