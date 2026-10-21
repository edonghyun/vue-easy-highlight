<script setup lang="ts">
import '@overlapmark/core/styles.css';
import { onMounted, ref } from 'vue';
import type {
    Highlight,
    HoverDetail,
    Overlap,
    PointDetail,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import { Highlighter } from '@overlapmark/vue';
import fixtures from '../../../fixtures.json';

const props = defineProps<{ params: Record<string, string> }>();

const fixture =
    fixtures[(props.params.fixture ?? 'overlaps') as keyof typeof fixtures];
const strategy = props.params.strategy as Strategy | undefined;
const overlap = props.params.overlap as Overlap | undefined;
const minSelectionLength = props.params.minSelectionLength
    ? Number(props.params.minSelectionLength)
    : undefined;
const decorate = props.params.decorate === '1';
const highlights = ref<Highlight[]>(
    fixture.highlights.map((h) =>
        props.params.className === '1' && h.id === 'a'
            ? { ...h, className: 'mine' }
            : h,
    ),
);

const record = (event: string, entry: object): void => {
    const item = document.createElement('li');
    item.dataset.event = event;
    item.textContent = JSON.stringify(entry);
    document.getElementById('log')!.append(item);
};
const idsOf = (covering: readonly Highlight[]): string[] =>
    covering.map((h) => h.id);

const onSelect = ({ start, end, text, highlights: covering }: SelectDetail) =>
    record('select', { start, end, text, ids: idsOf(covering) });
const onClick = ({ offset, highlights: covering }: PointDetail) =>
    record('click', { offset, ids: idsOf(covering) });
const onDblclick = ({ offset, highlights: covering }: PointDetail) =>
    record('dblclick', { offset, ids: idsOf(covering) });
const onHover = ({ type, highlights: covering, event }: HoverDetail) =>
    record('hover', {
        type,
        ids: idsOf(covering),
        eventIsNull: event === null,
    });

onMounted(() => {
    const json = document.getElementById(
        'highlights-json',
    ) as HTMLTextAreaElement;
    json.value = JSON.stringify(highlights.value, null, 2);
    document.getElementById('apply')!.addEventListener('click', () => {
        highlights.value = JSON.parse(json.value) as Highlight[];
    });
    document.body.dataset.harnessReady = 'true';
});
</script>

<template>
    <Highlighter
        :text="fixture.text"
        :highlights="highlights"
        :strategy="strategy"
        :overlap="overlap"
        :min-selection-length="minSelectionLength"
        @select="onSelect"
        @click="onClick"
        @dblclick="onDblclick"
        @hover="onHover"
    >
        <template v-if="decorate" #decoration="{ segment }">
            {{ segment.highlights.length }}
        </template>
    </Highlighter>
</template>
