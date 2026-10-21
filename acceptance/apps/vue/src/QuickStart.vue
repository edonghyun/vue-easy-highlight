<script setup lang="ts">
import '@overlapmark/core/styles.css';
import { ref } from 'vue';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/vue';

const text = 'Overlapping highlights get darker where they overlap.';
const highlights = ref<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
const add = ({ start, end }: SelectDetail) =>
    highlights.value.push({ id: crypto.randomUUID(), start, end });
</script>

<template>
    <Highlighter :text="text" :highlights="highlights" @select="add" />
</template>
