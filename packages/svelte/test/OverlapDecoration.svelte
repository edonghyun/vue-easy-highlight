<!-- A Highlighter whose decoration snippet renders only for overlaps. -->
<script lang="ts">
    import { Highlighter } from '../src/lib';
    import type { HighlighterProps } from '../src/lib';

    let props: HighlighterProps = $props();
</script>

<Highlighter {...props}>
    {#snippet decoration(segment)}
        {#if segment.depth > 1}overlap{/if}
    {/snippet}
</Highlighter>
