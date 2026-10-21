// The harness page contract (acceptance/harness-contract): the fixture
// chosen by the query, rendered with createHighlighter as the README shows,
// and every event appended to #log as JSON.
import '@overlapmark/core/styles.css';
import type { Highlight, Overlap, Segment, Strategy } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';
import fixtures from '../../../fixtures.json';

const params = new URLSearchParams(location.search);
const fixture =
    fixtures[(params.get('fixture') ?? 'overlaps') as keyof typeof fixtures];
let highlights: Highlight[] = fixture.highlights.map((h) =>
    params.get('className') === '1' && h.id === 'a'
        ? { ...h, className: 'mine' }
        : h,
);

const host = document.getElementById('host')!;
const width = params.get('width');
if (width) host.style.width = `${width}px`;
if (params.get('scroll') === '1') {
    const scroller = document.createElement('div');
    scroller.id = 'scroller';
    scroller.style.height = '200px';
    scroller.style.overflow = 'auto';
    host.replaceWith(scroller);
    scroller.append(host);
}
if (params.get('bg') === '1') {
    const tinted = document.createElement('div');
    tinted.id = 'tinted';
    tinted.style.background = '#e7f5ff';
    tinted.style.padding = '12px';
    host.replaceWith(tinted);
    tinted.append(host);
}
if (params.get('css') === 'default-color') {
    const style = document.createElement('style');
    style.textContent = '#host .om-root { --om-default-color: rgb(255, 0, 0) }';
    document.head.append(style);
}

const log = document.getElementById('log')!;
const record = (event: string, entry: object): void => {
    const item = document.createElement('li');
    item.dataset.event = event;
    item.textContent = JSON.stringify(entry);
    log.append(item);
};
const idsOf = (covering: readonly Highlight[]): string[] =>
    covering.map((h) => h.id);

const root = document.createElement('div');
host.append(root);
const strategy = params.get('strategy') as Strategy | null;
const overlap = params.get('overlap') as Overlap | null;
const minSelectionLength = params.get('minSelectionLength');
const hl = createHighlighter(root, {
    text: fixture.text,
    highlights,
    ...(strategy && { strategy }),
    ...(overlap && { overlap }),
    ...(minSelectionLength && {
        minSelectionLength: Number(minSelectionLength),
    }),
    ...(params.get('decorate') === '1' && {
        decorate: (segment: Segment) => String(segment.highlights.length),
    }),
});

hl.on('select', ({ start, end, text, highlights: covering }) =>
    record('select', { start, end, text, ids: idsOf(covering) }),
);
hl.on('click', ({ offset, highlights: covering }) =>
    record('click', { offset, ids: idsOf(covering) }),
);
hl.on('dblclick', ({ offset, highlights: covering }) =>
    record('dblclick', { offset, ids: idsOf(covering) }),
);
hl.on('hover', ({ type, highlights: covering, event }) =>
    record('hover', {
        type,
        ids: idsOf(covering),
        eventIsNull: event === null,
    }),
);

const json = document.getElementById('highlights-json') as HTMLTextAreaElement;
json.value = JSON.stringify(highlights, null, 2);
document.getElementById('apply')!.addEventListener('click', () => {
    highlights = JSON.parse(json.value) as Highlight[];
    hl.update({ highlights });
});

document.body.dataset.harnessReady = 'true';
