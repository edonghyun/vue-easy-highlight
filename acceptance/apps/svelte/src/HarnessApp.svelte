<script lang="ts">
    import '@overlapmark/core/styles.css';
    import { onMount } from 'svelte';
    import type {
        Highlight,
        HoverDetail,
        PointDetail,
        Segment,
        SelectDetail,
        Strategy,
    } from '@overlapmark/core';
    import { Highlighter } from '@overlapmark/svelte';
    import fixtures from '../../../fixtures.json';

    const params = Object.fromEntries(new URLSearchParams(location.search));

    const fixture =
        fixtures[(params.fixture ?? 'overlaps') as keyof typeof fixtures];
    const strategy = params.strategy as Strategy | undefined;
    const minSelectionLength = params.minSelectionLength
        ? Number(params.minSelectionLength)
        : undefined;
    const decorate = params.decorate === '1';
    let highlights = $state.raw<Highlight[]>(
        fixture.highlights.map((h) =>
            params.className === '1' && h.id === 'a'
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

    const onselect = ({
        start,
        end,
        text,
        highlights: covering,
    }: SelectDetail) =>
        record('select', { start, end, text, ids: idsOf(covering) });
    const onclick = ({ offset, highlights: covering }: PointDetail) =>
        record('click', { offset, ids: idsOf(covering) });
    const ondblclick = ({ offset, highlights: covering }: PointDetail) =>
        record('dblclick', { offset, ids: idsOf(covering) });
    const onhover = ({ type, highlights: covering, event }: HoverDetail) =>
        record('hover', {
            type,
            ids: idsOf(covering),
            eventIsNull: event === null,
        });

    onMount(() => {
        const json = document.getElementById(
            'highlights-json',
        ) as HTMLTextAreaElement;
        json.value = JSON.stringify(highlights, null, 2);
        document.getElementById('apply')!.addEventListener('click', () => {
            highlights = JSON.parse(json.value) as Highlight[];
        });
        document.body.dataset.harnessReady = 'true';
    });
</script>

{#snippet count(segment: Segment)}{segment.highlights.length}{/snippet}

<Highlighter
    text={fixture.text}
    {highlights}
    {strategy}
    {minSelectionLength}
    {onselect}
    {onclick}
    {ondblclick}
    {onhover}
    decoration={decorate ? count : undefined}
/>
