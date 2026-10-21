import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-600.css';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@overlapmark/core/styles.css';
import type { Highlight, Overlap, Strategy } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';
import { PASSAGE, ownColor, seedAnalyses } from './passage';
import type { Analysis, AnalysisRange } from './passage';
import { SNIPPETS } from './snippets';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} not found`);
    return el as T;
};

const radios = (name: string): HTMLInputElement[] => [
    ...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
];

function esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function excerpt(s: string, max: number): string {
    const flat = s.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// ---- theme ----------------------------------------------------------------

type ThemeChoice = 'auto' | 'light' | 'dark';

function storedTheme(): ThemeChoice {
    try {
        const v = localStorage.getItem('om-demo-theme');
        return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
        return 'auto';
    }
}

let themeChoice: ThemeChoice = storedTheme();

// ---- the passage ------------------------------------------------------------

const OVERLAP_EXPLAIN: Record<Overlap, string> = {
    multiply:
        'The default. Each layer multiplies with the ones under it, like a highlighter pen drawn over itself, so every extra analysis darkens the spot whatever its color. On a dark background it would also tint light text, which is why the reading cards stay paper-colored in the dark theme.',
    darken: 'Each nested layer mixes its own color toward --om-depth-ink by --om-depth-step per level and never blends with the page: predictable for colors of similar lightness, but a pale color inside a saturated one comes out lighter.',
    none: 'Plain translucent layers without a depth effect, for when you only need to show where analyses are, not how many.',
};

const STRATEGY_EXPLAIN: Record<Strategy, string> = {
    layers: 'Every analysis keeps its own color as a nested layer, and the overlap mode decides how the layers combine.',
    depth: 'Each stretch of text gets one color, its first analysis’s, darkened by how many analyses cover it; the overlap mode does not apply.',
};

let analyses: AnalysisRange[] = seedAnalyses();
let ownCount = 0;
let emphasized: string | null = null;
let overlap: Overlap = 'multiply';
let strategy: Strategy = 'layers';

/** What the inspector shows: the analyses under a spot, or a hint. */
type Inspected =
    | { kind: 'none' }
    | { kind: 'spot'; start: number; end: number; ids: string[] }
    | { kind: 'one'; id: string; added?: boolean };
let inspected: Inspected = { kind: 'none' };

const passageEl = $('passage');
const legendEl = $('legend');
const inspectorEl = $('inspector');
const statusEl = $('status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const oneColumn = matchMedia('(max-width: 860px)');

/** Says `message` to screen readers through the short live status line. */
function announce(message: string): void {
    statusEl.textContent = message;
}

/**
 * On one column the inspector sits below the passage, often off screen:
 * bring its answer into view after a click, Enter or selection.
 */
function revealInspector(): void {
    if (!oneColumn.matches) return;
    const { top } = inspectorEl.getBoundingClientRect();
    if (top >= 0 && top < innerHeight - 120) return;
    inspectorEl.scrollIntoView({
        block: 'start',
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
}
const peek = $('peek');

function passageHighlights(): Highlight<Analysis>[] {
    return analyses.map((a) => ({
        ...a,
        color: a.data.color,
        className: a.id === emphasized ? 'is-emph' : undefined,
    }));
}

const passage = createHighlighter<Analysis>(passageEl, {
    text: PASSAGE,
    highlights: passageHighlights(),
    overlap,
    strategy,
    // Screen readers hear the analyses' names after the text.
    describe: (covering) => covering.map((h) => h.data?.label).join(', '),
});

const byId = (id: string): AnalysisRange | undefined =>
    analyses.find((a) => a.id === id);

function swatch(color: string): string {
    return `<span class="swatch" style="background:${color}"></span>`;
}

function covered(): Set<string> {
    if (inspected.kind === 'spot') return new Set(inspected.ids);
    if (inspected.kind === 'one') return new Set([inspected.id]);
    return new Set();
}

function renderLegend(): void {
    const on = covered();
    legendEl.innerHTML = analyses
        .map(
            (a) =>
                `<li><button type="button" class="chip${on.has(a.id) ? ' is-covering' : ''}" data-id="${a.id}">` +
                `${swatch(a.data.color)}${esc(a.data.label)}</button></li>`,
        )
        .join('');
}

function card(a: AnalysisRange): string {
    const own = a.data.own
        ? `<div class="own"><input aria-label="Name of this analysis" data-rename="${a.id}" value="${esc(a.data.label)}" />` +
          `<button type="button" class="quiet" data-remove="${a.id}">Remove</button></div>`
        : '';
    return (
        `<li class="card">${swatch(a.data.color)}<span class="label">${esc(a.data.label)}</span>` +
        `<p class="quote">“${esc(excerpt(PASSAGE.slice(a.start, a.end), 110))}”</p>${own}</li>`
    );
}

function renderInspector(): void {
    if (inspected.kind === 'none') {
        inspectorEl.innerHTML =
            '<h3>Inspector</h3><p class="empty">Click or tap any highlighted words to see every analysis that covers them.</p>';
        return;
    }
    if (inspected.kind === 'one') {
        const a = byId(inspected.id);
        if (!a) {
            inspected = { kind: 'none' };
            renderInspector();
            return;
        }
        inspectorEl.innerHTML =
            `<h3>${esc(a.data.label)}</h3>` +
            (inspected.added
                ? '<p class="note">Added from your selection. Rename it or remove it here.</p>'
                : '') +
            `<ul class="cards">${card(a)}</ul>`;
        return;
    }
    const list = inspected.ids
        .map(byId)
        .filter((a): a is AnalysisRange => a !== undefined);
    inspectorEl.innerHTML =
        `<h3>“${esc(excerpt(spotText(inspected), 48))}”</h3>` +
        `<p class="note">${coverage(list.length)}, outermost first.</p>` +
        `<ul class="cards">${list.map(card).join('')}</ul>`;
}

function coverage(n: number): string {
    if (n === 0) return 'No analysis covers this spot';
    return n === 1
        ? '1 analysis covers this spot'
        : `${n} analyses cover this spot`;
}

/**
 * The text of a clicked spot. A spot of only spaces (between two sentences)
 * is widened to the words on either side, so the heading is never empty.
 */
function spotText({ start, end }: { start: number; end: number }): string {
    if (PASSAGE.slice(start, end).trim()) return PASSAGE.slice(start, end);
    while (start > 0 && /\S/.test(PASSAGE[start - 1]!)) start -= 1;
    while (end < PASSAGE.length && /\S/.test(PASSAGE[end]!)) end += 1;
    return PASSAGE.slice(start, end);
}

function sync(): void {
    passage.update({ highlights: passageHighlights() });
    renderLegend();
    renderInspector();
}

passage.on('click', ({ highlights, segment }) => {
    inspected = {
        kind: 'spot',
        start: segment.start,
        end: segment.end,
        ids: highlights.map((h) => h.id),
    };
    // The inspector now answers; no preview until the pointer moves on.
    peekMuted = true;
    hidePeek();
    renderLegend();
    renderInspector();
    announce(`${coverage(highlights.length)}.`);
    revealInspector();
});

passage.on('select', ({ start, end, text }) => {
    window.getSelection()?.removeAllRanges();
    if (!text.trim()) return;
    const same = analyses.find((a) => a.start === start && a.end === end);
    if (same) {
        inspected = { kind: 'one', id: same.id };
        renderLegend();
        renderInspector();
        announce(`${same.data.label} already covers this selection.`);
        revealInspector();
        return;
    }
    ownCount += 1;
    const id = `own-${ownCount}`;
    analyses = [
        ...analyses,
        {
            id,
            start,
            end,
            data: {
                label: `Your note ${ownCount}`,
                color: ownColor(ownCount),
                own: true,
            },
        },
    ];
    inspected = { kind: 'one', id, added: true };
    sync();
    announce(`Added Your note ${ownCount}.`);
    revealInspector();
});

// Hover preview: a small tooltip naming the analyses under the pointer.
let peekMuted = false;
function hidePeek(): void {
    peek.hidden = true;
}

function placePeek(x: number, y: number): void {
    const pad = 14;
    const { width, height } = peek.getBoundingClientRect();
    const left = Math.min(x + pad, innerWidth - width - 8);
    // Above the pointer, so the line being read stays visible.
    const top = y - pad - height < 8 ? y + pad : y - pad - height;
    peek.style.left = `${Math.max(8, left)}px`;
    peek.style.top = `${top}px`;
}

passage.on('hover', (d) => {
    if (d.type === 'leave') {
        peekMuted = false;
        hidePeek();
        return;
    }
    if (peekMuted || d.event.buttons) return;
    peek.innerHTML = d.highlights
        .map(
            (h) =>
                `<div class="row">${h.data ? swatch(h.data.color) : ''}${esc(h.data?.label ?? h.id)}</div>`,
        )
        .join('');
    peek.hidden = false;
    placePeek(d.event.clientX, d.event.clientY);
});

passageEl.addEventListener('pointerdown', hidePeek);
passageEl.addEventListener('pointermove', (e) => {
    if (!peek.hidden) placePeek(e.clientX, e.clientY);
});

// Legend chips: pointing at one outlines its analysis in the text.
function emphasize(id: string | null): void {
    if (emphasized === id) return;
    emphasized = id;
    passage.update({ highlights: passageHighlights() });
}

const chipId = (e: Event): string | null =>
    (e.target as HTMLElement).closest<HTMLElement>('.chip')?.dataset.id ?? null;

legendEl.addEventListener('pointerover', (e) => emphasize(chipId(e)));
legendEl.addEventListener('pointerleave', () => emphasize(null));
legendEl.addEventListener('focusin', (e) => emphasize(chipId(e)));
legendEl.addEventListener('focusout', () => emphasize(null));
legendEl.addEventListener('click', (e) => {
    const id = chipId(e);
    if (!id) return;
    inspected = { kind: 'one', id };
    renderLegend();
    renderInspector();
    legendEl.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus();
});

inspectorEl.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).dataset.remove;
    if (!id) return;
    const removed = byId(id);
    analyses = analyses.filter((a) => a.id !== id);
    if (removed) announce(`Removed ${removed.data.label}.`);
    if (inspected.kind === 'spot')
        inspected = {
            ...inspected,
            ids: inspected.ids.filter((i) => i !== id),
        };
    sync();
});

inspectorEl.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.rename;
    const a = id && byId(id);
    if (!a) return;
    a.data = { ...a.data, label: input.value || 'Untitled' };
    // Keep the input (and its caret) alive: refresh everything else.
    passage.update({ highlights: passageHighlights() });
    renderLegend();
    const label = input.closest('.card')?.querySelector('.label');
    if (label) label.textContent = a.data.label;
    const heading = inspectorEl.querySelector('h3');
    if (heading && inspected.kind === 'one') heading.textContent = a.data.label;
});

$('reset').addEventListener('click', () => {
    analyses = seedAnalyses();
    ownCount = 0;
    inspected = { kind: 'none' };
    sync();
    announce('Analyses reset.');
});

// ---- overlap and strategy toggles --------------------------------------------

function renderModes(): void {
    $('overlap-explain').textContent = OVERLAP_EXPLAIN[overlap];
    $('strategy-explain').textContent = STRATEGY_EXPLAIN[strategy];
    $('overlap-control').classList.toggle('is-off', strategy === 'depth');
}

for (const input of radios('overlap'))
    input.addEventListener('change', () => {
        overlap = input.value as Overlap;
        passage.update({ overlap });
        renderModes();
    });

for (const input of radios('strategy'))
    input.addEventListener('change', () => {
        strategy = input.value as Strategy;
        passage.update({ strategy });
        renderModes();
    });

// ---- the wordmark: the library drawing its own name ------------------------

createHighlighter($('wordmark'), {
    text: 'overlapmark',
    highlights: [
        { id: 'overlap', start: 0, end: 7, color: '#bcd6ff' },
        { id: 'lapmark', start: 4, end: 11, color: '#ffcadd' },
    ],
    focusable: false,
});

// ---- styling showcase ----------------------------------------------------------

const SAMPLE =
    'Read it once for the argument, again for the evidence, and a third time for what the author leaves out.';

const SAMPLE_RANGES: { id: string; part: string; color: string }[] = [
    { id: 's1', part: SAMPLE, color: '#5b9cff' },
    {
        id: 's2',
        part: 'for the argument, again',
        color: '#ff8fb8',
    },
    {
        id: 's3',
        part: 'again for the evidence, and a third time for what the author leaves out',
        color: '#4fd49b',
    },
    {
        id: 's4',
        part: 'a third time for what the author leaves out',
        color: '#b49bff',
    },
    {
        id: 's5',
        part: 'what the author leaves out',
        color: '#ffa64d',
    },
    {
        id: 's6',
        part: 'leaves out',
        color: '#ff7a7a',
    },
];

const PRESET_EXPLAIN: Record<string, string> = {
    '': 'The stylesheet’s default: a translucent fill per layer.',
    'om-style-marker':
        'om-style-marker paints a brush stroke from --om-brush (the brush option).',
    'om-style-underline':
        'om-style-underline: each nesting level’s underline sits 4px lower.',
    'om-style-box':
        'om-style-box: each nesting level’s box reaches 3px further.',
    squiggle:
        '.squiggle is a rule of this page: a wavy underline in --om-color, offset by --om-level. Your class rules always win over the stylesheet.',
};

let preset = '';
let badge = true;

function sampleHighlights(): Highlight[] {
    return SAMPLE_RANGES.map(({ id, part, color }) => {
        const start = SAMPLE.indexOf(part);
        return {
            id,
            start,
            end: start + part.length,
            color,
            className: preset || undefined,
        };
    });
}

function countBadge(segment: { depth: number }): Node | null {
    if (!badge || segment.depth < 2) return null;
    const el = document.createElement('span');
    el.className = 'badge';
    el.textContent = String(segment.depth);
    return el;
}

const sampleEl = $('sample');
const sample = createHighlighter(sampleEl, {
    text: SAMPLE,
    highlights: sampleHighlights(),
    overlap: 'darken',
    decorate: countBadge,
});

const knobs: { id: string; prop: string; unit: string }[] = [
    { id: 'alpha', prop: '--om-alpha', unit: '%' },
    { id: 'step', prop: '--om-depth-step', unit: '%' },
    { id: 'max-depth', prop: '--om-max-depth', unit: '' },
];

function renderKnobs(): void {
    const lines: string[] = [];
    for (const { id, prop, unit } of knobs) {
        const input = $<HTMLInputElement>(id);
        const value = `${input.value}${unit}`;
        sampleEl.style.setProperty(prop, value);
        const out = input.parentElement?.querySelector('output');
        if (out) out.textContent = value;
        lines.push(`    ${prop}: ${value};`);
    }
    $('css-out').textContent = `.om-root {\n${lines.join('\n')}\n}`;
}

for (const { id } of knobs) $(id).addEventListener('input', renderKnobs);

for (const input of radios('preset'))
    input.addEventListener('change', () => {
        preset = input.value;
        $('preset-explain').textContent = PRESET_EXPLAIN[preset] ?? '';
        sample.update({ highlights: sampleHighlights() });
    });

$<HTMLInputElement>('badge').addEventListener('change', (e) => {
    badge = (e.target as HTMLInputElement).checked;
    // decorate runs on every render: re-render to add or drop the badges.
    sample.update({ decorate: countBadge });
});

// ---- framework snippets ---------------------------------------------------------

// A tablist with roving tabindex: Tab enters at the selected tab, the
// arrow keys, Home and End move between tabs and select them.
const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
const tabPanel = $('snippet-panel');

function showTab(index: number, focus = false): void {
    tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (!selected) return;
        tabPanel.setAttribute('aria-labelledby', tab.id);
        $('snippet').textContent = SNIPPETS[tab.dataset.tab ?? ''] ?? '';
        if (focus) tab.focus();
    });
}

tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(i));
    tab.addEventListener('keydown', (e) => {
        const last = tabs.length - 1;
        const next =
            e.key === 'ArrowRight'
                ? (i + 1) % tabs.length
                : e.key === 'ArrowLeft'
                  ? (i + last) % tabs.length
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? last
                      : -1;
        if (next < 0) return;
        e.preventDefault();
        showTab(next, true);
    });
});

// ---- install line, theme ---------------------------------------------------------

$('copy').addEventListener('click', async () => {
    const button = $('copy');
    try {
        await navigator.clipboard.writeText($('install-cmd').textContent ?? '');
        button.textContent = 'Copied';
    } catch {
        button.textContent = 'Select and copy';
    }
    setTimeout(() => (button.textContent = 'Copy'), 1600);
});

function applyTheme(): void {
    const root = document.documentElement;
    if (themeChoice === 'auto') delete root.dataset.theme;
    else root.dataset.theme = themeChoice;
    $('theme').textContent = `Theme: ${themeChoice}`;
}

$('theme').addEventListener('click', () => {
    themeChoice =
        themeChoice === 'auto'
            ? 'light'
            : themeChoice === 'light'
              ? 'dark'
              : 'auto';
    try {
        localStorage.setItem('om-demo-theme', themeChoice);
    } catch {
        // private mode: the choice lasts for this page only
    }
    applyTheme();
});

renderModes();
renderKnobs();
$('preset-explain').textContent = PRESET_EXPLAIN[''] ?? '';
showTab(0);
applyTheme();
renderLegend();
renderInspector();
