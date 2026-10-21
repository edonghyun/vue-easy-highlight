import '@overlapmark/core/styles.css';
import { useEffect, useState } from 'react';
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import { Highlighter } from '@overlapmark/react';
import fixtures from '../../../fixtures.json';

const record = (event: string, entry: object): void => {
    const item = document.createElement('li');
    item.dataset.event = event;
    item.textContent = JSON.stringify(entry);
    document.getElementById('log')!.append(item);
};
const idsOf = (covering: readonly Highlight[]): string[] =>
    covering.map((h) => h.id);

const onSelect = ({ start, end, text, highlights }: SelectDetail) =>
    record('select', { start, end, text, ids: idsOf(highlights) });
const onClick = ({ offset, highlights }: PointDetail) =>
    record('click', { offset, ids: idsOf(highlights) });
const onDblClick = ({ offset, highlights }: PointDetail) =>
    record('dblclick', { offset, ids: idsOf(highlights) });
const onHover = ({ type, highlights, event }: HoverDetail) =>
    record('hover', {
        type,
        ids: idsOf(highlights),
        eventIsNull: event === null,
    });

export function HarnessApp({ params }: { params: Record<string, string> }) {
    const fixture =
        fixtures[(params.fixture ?? 'overlaps') as keyof typeof fixtures];
    const strategy = params.strategy as Strategy | undefined;
    const minSelectionLength = params.minSelectionLength
        ? Number(params.minSelectionLength)
        : undefined;
    const decorate = params.decorate === '1';
    const [highlights, setHighlights] = useState<Highlight[]>(
        fixture.highlights.map((h) =>
            params.className === '1' && h.id === 'a'
                ? { ...h, className: 'mine' }
                : h,
        ),
    );

    useEffect(() => {
        const json = document.getElementById(
            'highlights-json',
        ) as HTMLTextAreaElement;
        const apply = document.getElementById('apply')!;
        const onApply = () =>
            setHighlights(JSON.parse(json.value) as Highlight[]);
        json.value = JSON.stringify(highlights, null, 2);
        apply.addEventListener('click', onApply);
        document.body.dataset.harnessReady = 'true';
        return () => apply.removeEventListener('click', onApply);
        // The textarea shows the initial highlights; applying never rewrites it.
    }, []);

    return (
        <Highlighter
            text={fixture.text}
            highlights={highlights}
            strategy={strategy}
            minSelectionLength={minSelectionLength}
            onSelect={onSelect}
            onClick={onClick}
            onDblClick={onDblClick}
            onHover={onHover}
            renderDecoration={
                decorate ? (segment) => segment.highlights.length : undefined
            }
        />
    );
}
