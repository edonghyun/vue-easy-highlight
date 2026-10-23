// The docs page's reference tables. Each table is keyed by the library's own
// types, so `pnpm typecheck` fails when an option, field, event or method is
// missing here or does not exist. Text in backticks renders as code.
import type { Highlight } from '@overlapmark/core';
import type { Highlighter, HighlighterOptions } from '@overlapmark/dom';

export interface Row {
    name: string;
    type: string;
    default: string;
    description: string;
}

type Table<K extends PropertyKey> = { [P in K]-?: Row };

export const HIGHLIGHT_FIELDS: Table<keyof Highlight> = {
    id: {
        name: 'id',
        type: 'string',
        default: 'required',
        description:
            'Unique among the highlights you pass, and without whitespace: the ids covering a segment are written space-separated in its `data-om-ids`.',
    },
    start: {
        name: 'start',
        type: 'number',
        default: 'required',
        description: 'Integer UTF-16 index of the first character.',
    },
    end: {
        name: 'end',
        type: 'number',
        default: 'required',
        description:
            'Integer UTF-16 index after the last character (exclusive).',
    },
    color: {
        name: 'color',
        type: 'string',
        default: '`defaultColor`',
        description:
            "CSS color, set as `--om-color` on the highlight's element.",
    },
    className: {
        name: 'className',
        type: 'string',
        default: '—',
        description:
            "Class for the highlight's element, such as a preset: `om-style-marker`, `om-style-underline` or `om-style-box`.",
    },
    data: {
        name: 'data',
        type: 'T',
        default: '—',
        description:
            'A payload of your own. Events hand your highlight objects back, so you read it from there.',
    },
};

export const OPTIONS: Table<keyof HighlighterOptions> = {
    text: {
        name: 'text',
        type: 'string',
        default: 'required',
        description: 'The source text.',
    },
    highlights: {
        name: 'highlights',
        type: 'Highlight<T>[]',
        default: '`[]`',
        description: 'The highlights to render. See Highlight.',
    },
    strategy: {
        name: 'strategy',
        type: "'layers' | 'depth'",
        default: "`'layers'`",
        description:
            '`layers`: one nested element per highlight. `depth`: one element per segment, darkened by its overlap count.',
    },
    overlap: {
        name: 'overlap',
        type: "'multiply' | 'darken' | 'none'",
        default: "`'multiply'`",
        description:
            'How nested layers combine with the `layers` strategy; `depth` ignores it. See Overlap modes.',
    },
    focusable: {
        name: 'focusable',
        type: 'boolean',
        default: '`true`',
        description:
            'Make highlighted segments Tab stops (`tabindex="0"`, `role="button"`). Enter or Space reports `click`.',
    },
    describe: {
        name: 'describe',
        type: '(highlights: readonly Highlight<T>[]) => string',
        default: 'count',
        description:
            "The accessible description of a focusable segment: `'1 highlight'` / `'n highlights'` by default. Return `''` for none.",
    },
    defaultColor: {
        name: 'defaultColor',
        type: 'string',
        default: '`#ddd6ff`',
        description:
            'Color of highlights without `color`. When given, it is also set as `--om-default-color` on the root.',
    },
    brush: {
        name: 'brush',
        type: '(color: string) => string',
        default: 'built-in',
        description:
            'Returns a CSS image for `--om-brush`, which `om-style-marker` paints.',
    },
    minSelectionLength: {
        name: 'minSelectionLength',
        type: 'number',
        default: '`1`',
        description: 'Shorter selections do not report `select`.',
    },
    touchSelectionDelay: {
        name: 'touchSelectionDelay',
        type: 'number',
        default: '`500`',
        description:
            'Milliseconds without a selection change before a touch selection reports `select`.',
    },
    decorate: {
        name: 'decorate',
        type: '(segment: Segment<T>) => Node | string | null',
        default: '—',
        description:
            "Presentational markup after the text of each highlighted segment, such as a count. Return `null` or `''` for none. In Vue, React and Svelte this is the `decoration` slot, `renderDecoration` prop and `decoration` snippet.",
    },
};

type EventName = Parameters<Highlighter['on']>[0];

export const EVENTS: {
    [K in EventName]: { payload: string; description: string };
} = {
    select: {
        payload: '{ start, end, text, rect, highlights }',
        description:
            'A selection inside the root is finished: on the next task after the mouse button or key is released, or after `touchSelectionDelay` on touch. `highlights` are those overlapping the selection; `rect` is the bounding rect of the selected text inside the root.',
    },
    click: {
        payload: '{ offset, segment, highlights, event }',
        description:
            'A click or tap with no active selection, or Enter/Space on a focused highlight. `offset` is the character index; `highlights` lists every highlight covering it, `[]` on plain text.',
    },
    dblclick: {
        payload: '{ offset, segment, highlights, event }',
        description:
            "A double-click. The browser's own word selection stays in place.",
    },
    hover: {
        payload: "{ type: 'enter' | 'leave', segment, highlights, event }",
        description:
            'A mouse pointer enters or leaves a highlighted segment. Every `enter` is followed by one `leave`; a `leave` not caused by the pointer (destroy, or an update that removes the segment) has `event: null`. Touch and pen do not hover.',
    },
};

export const HIGHLIGHTER_METHODS: {
    [K in keyof Highlighter]: { signature: string; description: string };
} = {
    update: {
        signature: 'update(partial: Partial<HighlighterOptions<T>>): void',
        description:
            'Merge new options and re-render, keeping the selection (unless the text changed) and keyboard focus.',
    },
    on: {
        signature: 'on(type, fn): () => void',
        description:
            'Subscribe to `select`, `click`, `dblclick` or `hover`. Returns a function that removes this subscription.',
    },
    getSegments: {
        signature: 'getSegments(): readonly Segment<T>[]',
        description:
            'The current segments: `{ start, end, text, highlights, depth }`.',
    },
    destroy: {
        signature: 'destroy(): void',
        description:
            'Remove the listeners and restore the element to plain text.',
    },
};

export const CSS_VARIABLES = [
    {
        name: '--om-default-color',
        default: '#ddd6ff',
        description: 'Color of highlights that have no `color`.',
    },
    {
        name: '--om-alpha',
        default: '55%',
        description: 'Opacity of each layer (layers strategy).',
    },
    {
        name: '--om-depth-step',
        default: '12%',
        description: 'How much darker per level (darken mode, depth strategy).',
    },
    {
        name: '--om-depth-ink',
        default: 'black',
        description: 'What the darken mode mixes toward.',
    },
    {
        name: '--om-max-depth',
        default: '6',
        description: 'The depth at which darkening stops.',
    },
    {
        name: '--om-color',
        default: 'per highlight',
        description:
            'Set from `highlight.color` and reset on every `.om-hl`, so setting it on the root has no effect; set it in a class instead.',
    },
    {
        name: '--om-level',
        default: 'per layer',
        description: 'Layer index, 0 for the outermost (layers strategy).',
    },
] as const;

export const CSS_CLASSES = [
    { name: 'om-root', description: 'The root element.' },
    {
        name: 'om-seg',
        description:
            'Outermost element of a segment. A highlighted one carries `data-om-depth` and `data-om-ids`.',
    },
    {
        name: 'om-hl',
        description: 'A highlight element (`<mark>`), with `data-om-id`.',
    },
    {
        name: 'om-style-marker',
        description: 'Preset: a marker stroke from `--om-brush`.',
    },
    {
        name: 'om-style-underline',
        description: 'Preset: an underline; nested underlines stack 4px apart.',
    },
    {
        name: 'om-style-box',
        description: 'Preset: a box; nested boxes reach 3px further per level.',
    },
] as const;
