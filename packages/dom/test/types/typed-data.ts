// A type test: `types.node.test.ts` type-checks it, nothing runs it. The type
// of the highlights' `data` reaches every callback without a cast; each
// `@ts-expect-error` shows that `data` is not `any`.
import type { Highlight, Segment } from '@overlapmark/core';
import { expectTypeOf } from 'vitest';
import { createHighlighter } from '../../src';

interface Note {
    note: string;
}

declare const root: HTMLElement;

const notes: Highlight<Note>[] = [
    { id: 'a', start: 0, end: 5, data: { note: 'first' } },
];

const highlighter = createHighlighter(root, {
    text: 'Hello',
    highlights: notes,
    // The decoration.
    decorate: (segment) => {
        expectTypeOf(segment).toEqualTypeOf<Segment<Note>>();
        // @ts-expect-error `Note` has no `missing`.
        return segment.highlights[0]!.data?.missing ?? null;
    },
    // The accessible description.
    describe: (highlights) => {
        expectTypeOf(highlights[0]!.data).toEqualTypeOf<Note | undefined>();
        // @ts-expect-error `Note` has no `missing`.
        return highlights[0]!.data?.missing ?? '';
    },
});

// Event details.
highlighter.on('select', (detail) => {
    expectTypeOf(detail.highlights[0]!.data).toEqualTypeOf<Note | undefined>();
    // @ts-expect-error `Note` has no `missing`.
    return detail.highlights[0]!.data?.missing;
});
highlighter.on('hover', (detail) => {
    expectTypeOf(detail.segment).toEqualTypeOf<Segment<Note>>();
});
