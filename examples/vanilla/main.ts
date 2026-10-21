import '@overlapmark/core/styles.css';
import { findMatches } from '@overlapmark/core';
import type { Highlight } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';

const TEXT =
    'Lorem Ipsum is simply dummy text of the printing and typesetting industry. ' +
    'Lorem Ipsum has been the industry standard dummy text ever since the 1500s, ' +
    'when an unknown printer took a galley of type and scrambled it to make a type specimen book.';

const COLORS = ['#ddd6ff', '#ffd6d6', '#d6f0ff', '#d9f7be', '#ffe7ba'];

const $ = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} not found`);
    return el as T;
};

const stage = $('stage');
const status = $('status');
const list = $('ranges');
const strategySelect = $<HTMLSelectElement>('strategy');
const presetSelect = $<HTMLSelectElement>('preset');

let highlights: Highlight[] = [];
let nextId = 1;

function add(start: number, end: number): void {
    const id = `h${nextId}`;
    const color = COLORS[(nextId - 1) % COLORS.length];
    nextId += 1;
    highlights = [
        ...highlights,
        { id, start, end, color, className: presetSelect.value || undefined },
    ];
}

const highlighter = createHighlighter(stage, {
    text: TEXT,
    highlights,
    strategy: 'layers',
});

function esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function sync(): void {
    highlighter.update({ highlights });
    list.innerHTML = highlights
        .map(
            (h) =>
                `<li><span class="sw" style="background:${h.color}"></span>` +
                `${h.id} [${h.start}, ${h.end}) "${esc(TEXT.slice(h.start, h.end))}" ` +
                `<button type="button" data-del="${h.id}">remove</button></li>`,
        )
        .join('');
}

highlighter.on('select', ({ start, end, text }) => {
    add(start, end);
    sync();
    window.getSelection()?.removeAllRanges();
    status.textContent = `Added [${start}, ${end}) "${text}"`;
});

highlighter.on('click', ({ highlights: covering, segment }) => {
    status.textContent = covering.length
        ? `Clicked a segment with depth=${segment.depth}, covered by: ${covering.map((h) => h.id).join(', ')}`
        : 'No highlight here';
});

list.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).dataset.del;
    if (!id) return;
    highlights = highlights.filter((h) => h.id !== id);
    sync();
});

strategySelect.addEventListener('change', () => {
    highlighter.update({
        strategy: strategySelect.value as 'layers' | 'depth',
    });
});

$<HTMLInputElement>('q').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target as HTMLInputElement;
    const found = findMatches(TEXT, input.value);
    for (const m of found) add(m.start, m.end);
    sync();
    status.textContent = `"${input.value}": added ${found.length} match(es)`;
});

const width = $<HTMLInputElement>('w');
width.addEventListener('input', () => {
    stage.style.setProperty('--stage-w', `${width.value}px`);
    stage.style.width = `${width.value}px`;
    $('wv').textContent = `${width.value}px`;
});

$('reset').addEventListener('click', () => {
    highlights = [];
    nextId = 1;
    // Two overlapping starter highlights so the overlap is visible right away.
    add(
        TEXT.indexOf('dummy text'),
        TEXT.indexOf('dummy text') + 'dummy text of the printing'.length,
    );
    add(
        TEXT.indexOf('text of the'),
        TEXT.indexOf('text of the') + 'text of the printing and'.length,
    );
    sync();
    status.textContent = 'Reset';
});

$('reset').click();
