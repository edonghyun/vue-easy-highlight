// A type test: `types.node.test.ts` type-checks it, nothing runs it. The type
// of the highlights' `data` reaches every callback without a cast; each
// `@ts-expect-error` shows that `data` is not `any`.
import type { Highlight, Segment } from '@overlapmark/core';
import { expectTypeOf } from 'vitest';
import { Highlighter } from '../../src';

interface Note {
    note: string;
}

const notes: Highlight<Note>[] = [
    { id: 'a', start: 0, end: 5, data: { note: 'first' } },
];

// Event details.
<Highlighter
    text="Hello"
    highlights={notes}
    onSelect={(detail) => {
        expectTypeOf(detail.highlights[0].data).toEqualTypeOf<
            Note | undefined
        >();
        // @ts-expect-error `Note` has no `missing`.
        return detail.highlights[0].data?.missing;
    }}
    onHover={(detail) => {
        expectTypeOf(detail.segment).toEqualTypeOf<Segment<Note>>();
    }}
/>;

// The decoration render prop.
<Highlighter
    text="Hello"
    highlights={notes}
    renderDecoration={(segment) => {
        expectTypeOf(segment).toEqualTypeOf<Segment<Note>>();
        // @ts-expect-error `Note` has no `missing`.
        return segment.highlights[0].data?.missing;
    }}
/>;

// The accessible description.
<Highlighter
    text="Hello"
    highlights={notes}
    describe={(highlights) => {
        expectTypeOf(highlights[0].data).toEqualTypeOf<Note | undefined>();
        // @ts-expect-error `Note` has no `missing`.
        return highlights[0].data?.missing;
    }}
/>;
