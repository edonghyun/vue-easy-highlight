import './fonts';
import '@overlapmark/core/styles.css';
import './site.css';
import './docs.css';
import type { Overlap } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';
import {
    CSS_CLASSES,
    CSS_VARIABLES,
    EVENTS,
    HIGHLIGHT_FIELDS,
    HIGHLIGHTER_METHODS,
    OPTIONS,
    type Row,
} from './api-data';
import { QUICK_STARTS } from './quick-starts';
import { SAMPLES, type Label } from './samples';
import { mountTabs } from './tabs';

/** `text` as HTML, with `backticked` spans as code. */
function inline(text: string): string {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Fills `<table data-table="name">` with a header and one row per entry. */
function table(name: string, head: string[], rows: string[][]): void {
    const el = document.querySelector(`table[data-table="${name}"]`)!;
    el.innerHTML =
        `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((cells) => `<tr>${cells.join('')}</tr>`).join('')}</tbody>`;
}

const code = (s: string) => `<td><code>${inline(s)}</code></td>`;
const type = (s: string) => `<td class="type"><code>${inline(s)}</code></td>`;
const text = (s: string) => `<td>${inline(s)}</td>`;
const rowCells = (r: Row) => [
    code(r.name),
    type(r.type),
    text(r.default),
    text(r.description),
];

table(
    'highlight',
    ['Field', 'Type', 'Default', 'Description'],
    Object.values(HIGHLIGHT_FIELDS).map(rowCells),
);
table(
    'options',
    ['Option', 'Type', 'Default', 'Description'],
    Object.values(OPTIONS).map(rowCells),
);
table(
    'methods',
    ['Method', 'Description'],
    Object.values(HIGHLIGHTER_METHODS).map((m) => [
        code(m.signature),
        text(m.description),
    ]),
);
table(
    'events',
    ['Event', 'Detail', 'When'],
    Object.entries(EVENTS).map(([name, e]) => [
        code(name),
        type(e.payload),
        text(e.description),
    ]),
);
table(
    'variables',
    ['Variable', 'Default', 'Description'],
    CSS_VARIABLES.map((v) => [
        code(v.name),
        text(v.default),
        text(v.description),
    ]),
);
table(
    'classes',
    ['Class', 'Meaning'],
    CSS_CLASSES.map((c) => [code(`.${c.name}`), text(c.description)]),
);

mountTabs(
    document.getElementById('quick-starts')!,
    Object.entries(QUICK_STARTS).map(([label, { lang, code }]) => ({
        label: label === 'vanilla JS' ? 'Vanilla' : label,
        lang,
        code,
    })),
);

// Live examples.

for (const figure of document.querySelectorAll<HTMLElement>(
    '#ex-modes [data-mode]',
)) {
    createHighlighter<Label>(figure.querySelector('.stage')!, {
        ...SAMPLES.modes,
        overlap: figure.dataset.mode as Overlap,
        focusable: false,
    });
}

const presets = document.getElementById('ex-styling')!;
for (const [label, className] of [
    ['Fill', ''],
    ['om-style-marker', 'om-style-marker'],
    ['om-style-underline', 'om-style-underline'],
    ['om-style-box', 'om-style-box'],
]) {
    const figure = document.createElement('figure');
    figure.className = 'card';
    const caption = document.createElement('figcaption');
    caption.className = 'bar';
    caption.textContent = className ? `className: '${label}'` : 'no className';
    const stage = document.createElement('div');
    stage.className = 'stage';
    figure.append(caption, stage);
    presets.append(figure);
    createHighlighter<Label>(stage, {
        text: SAMPLES.styling.text,
        highlights: SAMPLES.styling.highlights.map((h) =>
            className ? { ...h, className } : h,
        ),
        focusable: false,
    });
}

const log = document.getElementById('ex-events-log')!;
function record(line: string): void {
    const item = document.createElement('li');
    item.textContent = line;
    log.prepend(item);
    while (log.children.length > 5) log.lastElementChild!.remove();
}
const count = (n: number) => `${n} ${n === 1 ? 'highlight' : 'highlights'}`;
const events = createHighlighter<Label>(
    document.getElementById('ex-events-stage')!,
    SAMPLES.passage,
);
events.on('click', ({ offset, highlights }) =>
    record(`click · offset ${offset} · ${count(highlights.length)}`),
);
events.on('dblclick', ({ offset, highlights }) =>
    record(`dblclick · offset ${offset} · ${count(highlights.length)}`),
);
events.on('select', ({ start, end, highlights }) =>
    record(`select · ${start}–${end} · ${count(highlights.length)}`),
);
events.on('hover', ({ type, highlights }) =>
    record(`hover ${type} · ${count(highlights.length)}`),
);

// Table of contents: open on wide screens, collapsed on narrow ones, and the
// section at the top of the viewport marked as current.

const toc = document.querySelector<HTMLDetailsElement>('#toc details')!;
const wide = matchMedia('(min-width: 861px)');
const syncToc = () => (toc.open = wide.matches);
wide.addEventListener('change', syncToc);
syncToc();

const links = [...document.querySelectorAll<HTMLAnchorElement>('#toc a')];
const sections = links.map((a) => document.getElementById(a.hash.slice(1))!);
for (const a of links)
    a.addEventListener('click', () => {
        if (!wide.matches) toc.open = false;
    });

let frame = 0;
function markCurrent(): void {
    frame = 0;
    let current = 0;
    sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top <= 96) current = i;
    });
    links.forEach((a, i) => {
        if (i === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
    });
}
addEventListener(
    'scroll',
    () => (frame ||= requestAnimationFrame(markCurrent)),
    { passive: true },
);
markCurrent();
