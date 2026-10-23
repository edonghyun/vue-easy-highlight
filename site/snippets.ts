// The same small highlighter in each adapter, shown on the demo page.
export const SNIPPETS: Record<string, string> = {
    vanilla: `import '@overlapmark/core/styles.css';
import { createHighlighter } from '@overlapmark/dom';

let highlights = [{ id: 'a', start: 0, end: 20, color: '#5b9cff' }];
const hl = createHighlighter(document.getElementById('text'), {
    text,
    highlights,
});

hl.on('select', ({ start, end }) => {
    highlights = [...highlights, { id: crypto.randomUUID(), start, end }];
    hl.update({ highlights });
});
hl.on('click', ({ highlights }) => console.log(highlights.map((h) => h.id)));`,
    vue: `<script setup lang="ts">
import '@overlapmark/core/styles.css';
import { ref } from 'vue';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/vue';

const highlights = ref<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
const add = ({ start, end }: SelectDetail) =>
    highlights.value.push({ id: crypto.randomUUID(), start, end });
</script>

<template>
    <Highlighter :text="text" :highlights="highlights" @select="add" />
</template>`,
    react: `import '@overlapmark/core/styles.css';
import { useState } from 'react';
import type { Highlight, SelectDetail } from '@overlapmark/core';
import { Highlighter } from '@overlapmark/react';

export function Article({ text }: { text: string }) {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const add = ({ start, end }: SelectDetail) =>
        setHighlights((list) => [...list, { id: crypto.randomUUID(), start, end }]);
    return <Highlighter text={text} highlights={highlights} onSelect={add} />;
}`,
    svelte: `<script lang="ts">
    import '@overlapmark/core/styles.css';
    import type { Highlight, SelectDetail } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';

    let { text } = $props();
    let highlights = $state<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
    const add = ({ start, end }: SelectDetail) =>
        highlights.push({ id: crypto.randomUUID(), start, end });
</script>

<Highlighter {text} {highlights} onselect={add} />`,
};
