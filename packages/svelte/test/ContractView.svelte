<!--
    The contract factory's view: the suite's props on a Highlighter, its
    events into `record`, and the contract's decoration text through the
    decoration snippet.
-->
<script lang="ts">
    import { propsOf } from '@overlapmark/adapter-contract';
    import type {
        ContractProps,
        RecordEvent,
    } from '@overlapmark/adapter-contract';
    import type { Segment } from '@overlapmark/core';
    import { Highlighter } from '../src/lib';

    let { props, record }: { props: ContractProps; record: RecordEvent } =
        $props();

    // propsOf: fixtures carry extra fields (such as `name`) that would land on
    // the root div as attributes.
    const own = $derived(propsOf(props));
    const { decoration: _, ...rest } = $derived(own);
</script>

{#snippet decorate(segment: Segment)}{own.decoration?.(segment)}{/snippet}

<Highlighter
    {...rest}
    decoration={own.decoration && decorate}
    onselect={(detail) => record({ type: 'select', detail })}
    onclick={(detail) => record({ type: 'click', detail })}
    ondblclick={(detail) => record({ type: 'dblclick', detail })}
    onhover={(detail) => record({ type: 'hover', detail })}
/>
