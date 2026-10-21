<!-- A Highlighter inside `{#if shown}`, as a parent toggling it renders it. -->
<script lang="ts">
    import { Highlighter } from '../src/lib';
    import type { HighlighterProps } from '../src/lib';

    let { shown, props }: { shown: boolean; props: HighlighterProps } =
        $props();
</script>

<section>
    {#if shown}
        <Highlighter {...props} />
    {/if}
</section>
