<!--
    The view the SSR tests render on the server and hydrate in the browser:
    a Highlighter of `props`, decorated with `decorationOf` each segment when
    `decorated`. Everything but `onclick` is data, so the server receives the
    same props over the browser command.
-->
<script lang="ts">
    import type { PointDetail, Segment } from '@overlapmark/core';
    import { Highlighter } from '../src/lib';
    import { decorationOf } from './server-view.ts';
    import type { ServerViewProps } from './server-view.ts';

    let {
        props,
        decorated = false,
        onclick,
    }: ServerViewProps & { onclick?: (detail: PointDetail) => void } = $props();
</script>

{#snippet decorate(segment: Segment)}{decorationOf(segment)}{/snippet}

<Highlighter
    {...props}
    decoration={decorated ? decorate : undefined}
    {onclick}
/>
