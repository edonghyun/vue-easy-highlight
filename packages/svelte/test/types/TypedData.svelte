<!--
    Type test, checked by svelte-check and never rendered: the type of the
    highlights' `data` reaches every callback and the decoration snippet
    without a cast. Each `@ts-expect-error` shows that `data` is not `any`.
-->
<script lang="ts">
    import type { Highlight, Segment } from '@overlapmark/core';
    import { expectTypeOf } from 'vitest';
    import { Highlighter } from '../../src/lib';

    interface Note {
        note: string;
    }

    const notes: Highlight<Note>[] = [
        { id: 'a', start: 0, end: 5, data: { note: 'first' } },
    ];
</script>

<Highlighter
    text="Hello"
    highlights={notes}
    onselect={(detail) => {
        expectTypeOf(detail.highlights[0]!.data).toEqualTypeOf<
            Note | undefined
        >();
        // @ts-expect-error `Note` has no `missing`.
        return detail.highlights[0]!.data?.missing;
    }}
    onhover={(detail) => {
        expectTypeOf(detail.segment).toEqualTypeOf<Segment<Note>>();
    }}
    describe={(highlights) => {
        expectTypeOf(highlights[0]!.data).toEqualTypeOf<Note | undefined>();
        // @ts-expect-error `Note` has no `missing`.
        return highlights[0]!.data?.missing ?? '';
    }}
>
    {#snippet decoration(segment)}
        {expectTypeOf(segment).toEqualTypeOf<Segment<Note>>()}
        {// @ts-expect-error `Note` has no `missing`.
        segment.highlights[0]!.data?.missing}
    {/snippet}
</Highlighter>
