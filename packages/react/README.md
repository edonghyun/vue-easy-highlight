# @overlapmark/react

React component for overlapmark: render overlapping text highlights and listen to selections, clicks and hovers. Built on [`@overlapmark/core`](https://www.npmjs.com/package/@overlapmark/core); renders the same DOM as [`@overlapmark/dom`](https://www.npmjs.com/package/@overlapmark/dom). Overlapping highlights get darker, and a click reports every highlight covering that spot: see the [overlapmark README](https://github.com/edonghyun/overlapmark#readme) and the **[live demo](https://edonghyun.github.io/overlapmark/)**.

```sh
npm install @overlapmark/react @overlapmark/core
```

Requires React 18 or later (`react` and `react-dom`). The tests run on React 19; on React 18.3 the types are checked and the core scenarios run. Install `@overlapmark/core` next to it: you import its stylesheet and types yourself.

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

## More

A class on the root, and handlers for clicks:

```tsx
import '@overlapmark/core/styles.css';
import { useState } from 'react';
import type { Highlight } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/react';

const text = 'Overlapping highlights get darker where they overlap.';

export function Article() {
    const [highlights, setHighlights] = useState<Highlight[]>([
        { id: 'a', start: 0, end: 20 },
    ]);

    return (
        <Highlighter
            className="article"
            text={text}
            highlights={highlights}
            onSelect={({ start, end }) =>
                setHighlights((list) => [
                    ...list,
                    { id: crypto.randomUUID(), start, end },
                ])
            }
            onClick={({ highlights }) =>
                console.log(highlights.map((h) => h.id))
            }
        />
    );
}
```

## Props

| Prop                  | Type                                              | Default      | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                | `string`                                          | required     | The source text. Positions are UTF-16 indices.                                                                                                          |
| `highlights`          | `Highlight<T>[]`                                  | `[]`         | `{ id, start, end, color?, className?, data? }`; `end` is exclusive; ids unique and without whitespace                                                  |
| `strategy`            | `'layers' \| 'depth'`                             | `'layers'`   | How overlaps are drawn                                                                                                                                  |
| `overlap`             | `'multiply' \| 'darken' \| 'none'`                | `'multiply'` | How nested layers combine with `layers` ([overlap modes](https://github.com/edonghyun/overlapmark#overlap-modes)); the `depth` strategy ignores it      |
| `focusable`           | `boolean`                                         | `true`       | Put `tabindex="0"` and `role="button"` on highlighted segments; Enter/Space calls `onClick`                                                             |
| `describe`            | `(highlights: readonly Highlight<T>[]) => string` | count        | The accessible description of a focusable segment, from the highlights covering it: `'1 highlight'` / `` `${n} highlights` `` by default; `''` for none |
| `defaultColor`        | `string`                                          | `#ddd6ff`    | Color of highlights without `color`: set as `--om-default-color` on the root and baked into their `--om-brush`                                          |
| `brush`               | `(color: string) => string`                       | built-in     | Returns a CSS image value for `--om-brush` (used by `om-style-marker`)                                                                                  |
| `minSelectionLength`  | `number`                                          | `1`          | Shorter selections do not call `onSelect`                                                                                                               |
| `touchSelectionDelay` | `number`                                          | `500`        | Milliseconds of no selection change before `onSelect` fires on touch; a change applies from the next selection change                                   |
| `renderDecoration`    | `(segment) => ReactNode`                          | none         | Decoration for each highlighted segment; see [Decorations](#decorations)                                                                                |

The component renders a single `<div class="om-root">`. `className` is added to `om-root`; `style`, `id`, `aria-*`, `data-*` and the other `div` props, DOM handlers such as `onPointerDown` included, land on that `div`, and `ref` (an object or callback ref) receives it. The root's own `data-om-strategy` (from `strategy`) and `data-om-overlap` (from `overlap`) always win over ones you pass. The component renders its children itself, so `children` and `dangerouslySetInnerHTML` are not accepted. The props types are exported as `HighlighterProps` and `HighlighterOwnProps`.

`Highlighter` is generic over the `data` of your highlights: given `Highlight<Note>[]`, the handlers receive `Highlight<Note>` objects. They are your own objects, so `detail.highlights[0] === myHighlight` holds.

Passing a new array of the same highlights, as a re-rendering parent often does, leaves the DOM untouched: the selection and the hovered segment stay as they are. The segments are recomputed when `text` or the `highlights` array changes identity, so keep the array in state (or `useMemo`) rather than building it differently on every render when the list is large.

## Handlers

| Prop                    | Detail                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `onSelect`              | `{ start, end, text, rect, highlights }` (highlights overlapping the selection)                             |
| `onClick`, `onDblClick` | `{ offset, segment, highlights, event }` (`event` is a `MouseEvent` or, for Enter/Space, a `KeyboardEvent`) |
| `onHover`               | `{ type: 'enter' \| 'leave', segment, highlights, event }`; mouse pointers only (not touch or pen)          |

These are not DOM handlers: they receive core's detail objects (`SelectDetail`, `PointDetail`, `HoverDetail` from `@overlapmark/core`), never a React event, and the `div`'s own `onSelect`, `onClick` and `onDoubleClick` are not available. To handle the raw DOM click, wrap the component or use `onPointerDown`/`onPointerUp`. Their timing is the same as in [`@overlapmark/dom`](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#events).

The component always calls the handlers of the latest render. Passing a new function (an inline arrow) on every render is fine: it does not re-attach the listeners, so a hover or a touch selection in progress carries on.

Every hover `enter` is followed by one `leave` for the same `segment` object. Besides the mouse moving away, unmounting the component and an update that removes the hovered highlight from under the mouse also call `onHover` with its `leave`, with `event: null`. Under `<StrictMode>` each gesture still calls a handler once.

## What an update keeps

When props change, the component re-renders and keeps the user's selection and keyboard focus by the same rules as `@overlapmark/dom`'s `update()` (see [What `update()` keeps](https://github.com/edonghyun/overlapmark/tree/main/packages/dom#what-update-keeps)): the selection stays at the same text offsets unless the text changed, and focus returns to the same segment or to the highlighted segment now covering it. Both are restored in the same commit as the DOM patch.

## Decorations

`renderDecoration` is the full-control styling tier: return presentational content, such as a count or an icon, for each highlighted segment.

```tsx
<Highlighter
    text={text}
    highlights={highlights}
    renderDecoration={(segment) =>
        segment.depth > 1 ? <sup>×{segment.depth}</sup> : null
    }
/>
```

What it returns goes in `<span data-om-skip aria-hidden="true">`, the last child of the segment's innermost element (right after its text). It never shifts the offsets `onSelect` and `onClick` report, the shipped stylesheet keeps it out of selections and copies, and it is hidden from assistive technology, so it must not contain buttons, links or other focusable content. A segment it returns `null`, `undefined`, a boolean, `''` or an empty array for gets no container. Plain segments are not decorated.

## Server-side rendering

The component renders the same markup on the server (`renderToString`) as on the client and hydrates with `hydrateRoot` without mismatches; handlers work once it is hydrated. It reads no `window` or `document` while rendering. Import `@overlapmark/core/styles.css` yourself; the component injects no CSS.

### React Server Components and Next.js

The package entry starts with `'use client'`, so the Next.js App Router (or any React Server Components setup) treats `Highlighter` as a Client Component. A Server Component can render it with plain props, but functions cannot cross from the server to the client: when you pass handlers (`onSelect`, `onClick`, …), `describe`, `brush` or `renderDecoration`, render `Highlighter` from a Client Component of your own:

```tsx
'use client';

import { useState } from 'react';
import type { Highlight } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/react';

export function Annotated({ text }: { text: string }) {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    return (
        <Highlighter
            text={text}
            highlights={highlights}
            onSelect={({ start, end }) =>
                setHighlights((list) => [
                    ...list,
                    { id: `h${start}-${end}`, start, end },
                ])
            }
        />
    );
}
```

Import `@overlapmark/core/styles.css` once in your root layout.

## Styling and accessibility

The shipped stylesheet has three levels of control: CSS variables (`--om-default-color` `#ddd6ff`, `--om-alpha` `55%`, `--om-depth-step` `12%`, `--om-depth-ink` `black`, `--om-max-depth` `6`), a `color` and `className` per highlight (presets `om-style-marker`, `om-style-underline`, `om-style-box`), and decorations (above). The classes, attributes and CSS variables you can style are listed in the [DOM contract](https://github.com/edonghyun/overlapmark/tree/main/packages/core#dom-contract), and the [styling guide](https://github.com/edonghyun/overlapmark#styling) shows each level.

With `focusable` on (the default), every highlighted segment is a Tab stop, announced as a button with its text and the `describe` description ("2 highlights"); Enter or Space calls `onClick`. For densely annotated text, set `focusable` to `false`. See [Accessibility](https://github.com/edonghyun/overlapmark#accessibility).

## Known limitations

- The full tests run on React 19; on React 18.3 an app type-checks against the published types and runs the core scenarios (select, click, keyboard activation, update) in Chromium.
- Server rendering is verified with React's development build, which reports hydration mismatches; what the production build does on a mismatch is not tested.
- Hiding the component with `<Activity mode="hidden">` while a segment is hovered calls `onHover` with a `leave` (`event: null`).
- ES modules only.

The [overlapmark README](https://github.com/edonghyun/overlapmark#readme) has the overlap modes, browser support (`color-mix()` is required), shadow DOM and iframes, dev warnings and all [known limitations](https://github.com/edonghyun/overlapmark#known-limitations).

## License

MIT
