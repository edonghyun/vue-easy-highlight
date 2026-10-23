// The four framework quick starts, shown on both pages. Each `code` is the
// first code block under `## Quick start (<key>)` in the root README;
// `pnpm check:readme` fails when they drift apart.

export const QUICK_STARTS = {
    'vanilla JS': {
        lang: 'ts',
        code: `import '@overlapmark/core/styles.css';
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
`,
    },
    Vue: {
        lang: 'vue',
        code: `<script setup lang="ts">
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
`,
    },
    React: {
        lang: 'tsx',
        code: `import '@overlapmark/core/styles.css';
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
`,
    },
    Svelte: {
        lang: 'svelte',
        code: `<script lang="ts">
    import '@overlapmark/core/styles.css';
    import type { Highlight, SelectDetail } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';

    const text = 'Overlapping highlights get darker where they overlap.';
    let highlights = $state<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
    const add = ({ start, end }: SelectDetail) =>
        highlights.push({ id: crypto.randomUUID(), start, end });
</script>

<Highlighter {text} {highlights} onselect={add} />
`,
    },
} as const satisfies Record<string, { lang: string; code: string }>;
