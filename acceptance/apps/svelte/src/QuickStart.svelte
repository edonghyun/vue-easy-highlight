<script lang="ts">
    import '@overlapmark/core/styles.css';
    import type { Highlight, SelectDetail } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';

    const text = 'Overlapping highlights get darker where they overlap.';
    let highlights = $state<Highlight[]>([{ id: 'a', start: 0, end: 20 }]);
    const add = ({ start, end }: SelectDetail) =>
        highlights.push({ id: crypto.randomUUID(), start, end });
</script>

<Highlighter {text} {highlights} onselect={add} />
