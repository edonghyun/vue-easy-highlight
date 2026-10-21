<!--
    A type test: `types.node.test.ts` checks it with vue-tsc, nothing renders
    it. The type of the highlights' `data` reaches the event details,
    `describe` and the decoration slot without a cast; each
    `@ts-expect-error` shows that `data` is not `any`.
-->
<script setup lang="ts">
import type { Highlight, Segment, SelectDetail } from '@overlapmark/core';
import { expectTypeOf } from 'vitest';
import { Highlighter } from '../../src';

interface Note {
    note: string;
}

const notes: Highlight<Note>[] = [
    { id: 'a', start: 0, end: 5, data: { note: 'first' } },
];

// What the decoration slot's `segment` must be, for the template, which
// cannot spell a type argument.
const noteSegment = {} as Segment<Note>;

function onSelect(detail: SelectDetail<Note>): void {
    expectTypeOf(detail.highlights[0]!.data).toEqualTypeOf<Note | undefined>();
}
</script>

<template>
    <Highlighter
        text="Hello"
        :highlights="notes"
        :describe="
            (highlights) => {
                expectTypeOf(highlights[0]!.data).toEqualTypeOf<
                    Note | undefined
                >();
                // @ts-expect-error `Note` has no `missing`.
                return highlights[0]!.data?.missing ?? '';
            }
        "
        @select="onSelect"
        @click="
            (detail) => {
                expectTypeOf(detail.highlights[0]!.data).toEqualTypeOf<
                    Note | undefined
                >();
                // @ts-expect-error `Note` has no `missing`.
                return detail.highlights[0]!.data?.missing;
            }
        "
    >
        <template #decoration="{ segment }">
            {{ expectTypeOf(segment).toEqualTypeOf(noteSegment) }}
            {{
                // @ts-expect-error `Note` has no `missing`.
                segment.highlights[0]!.data?.missing
            }}
        </template>
    </Highlighter>
</template>
