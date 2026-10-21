import '@overlapmark/core/styles.css';
import type { Highlight, Overlap, Strategy } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';
import { PASSAGE, ownTone, seedAnalyses } from './passage';
import type { Analysis, AnalysisRange, Tone } from './passage';
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
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function storedTheme(): ThemeChoice {
    try {
        const v = localStorage.getItem('om-demo-theme');
        return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
        return 'auto';
    }
}

let themeChoice: ThemeChoice = storedTheme();
const dark = (): boolean =>
    themeChoice === 'dark' || (themeChoice === 'auto' && darkQuery.matches);
const paint = (tone: Tone): string => (dark() ? tone.dark : tone.light);

// ---- the passage ------------------------------------------------------------

const OVERLAP_EXPLAIN: Record<Overlap, string> = {
    multiply:
        'The default. Each layer multiplies with the ones under it, like a highlighter pen drawn over itself, so every extra analysis darkens the spot whatever its color; it suits light pages, since on a dark one it also tints light text.',
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
// Multiply tints light text on a dark page, so a dark theme starts in
// darken until the visitor picks a mode.
let overlapPicked = false;
const themeOverlap = (): Overlap => (dark() ? 'darken' : 'multiply');
let overlap: Overlap = themeOverlap();
let strategy: Strategy = 'layers';

/** What the inspector shows: the analyses under a spot, or a hint. */
type Inspected =
    | { kind: 'none' }
    | { kind: 'spot'; text: string; ids: string[] }
    | { kind: 'one'; id: string; added?: boolean };
let inspected: Inspected = { kind: 'none' };

const passageEl = $('passage');
const legendEl = $('legend');
const inspectorEl = $('inspector');
const peek = $('peek');

function passageHighlights(): Highlight<Analysis>[] {
    return analyses.map((a) => ({
        ...a,
        color: paint(a.data.tone),
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

function swatch(tone: Tone): string {
    return `<span class="swatch" style="background:${paint(tone)}"></span>`;
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
                `${swatch(a.data.tone)}${esc(a.data.label)}</button></li>`,
        )
        .join('');
}

function card(a: AnalysisRange): string {
    const own = a.data.own
        ? `<div class="own"><input aria-label="Name of this analysis" data-rename="${a.id}" value="${esc(a.data.label)}" />` +
          `<button type="button" class="quiet" data-remove="${a.id}">Remove</button></div>`
        : '';
    return (
        `<li class="card">${swatch(a.data.tone)}<span class="label">${esc(a.data.label)}</span>` +
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
        `<h3>“${esc(excerpt(inspected.text, 48))}”</h3>` +
        `<p class="note">${list.length === 1 ? '1 analysis covers' : `${list.length} analyses cover`} this spot, outermost first.</p>` +
        `<ul class="cards">${list.map(card).join('')}</ul>`;
}

function sync(): void {
    passage.update({ highlights: passageHighlights() });
    renderLegend();
    renderInspector();
}

passage.on('click', ({ highlights, segment }) => {
    inspected = {
        kind: 'spot',
        text: segment.text,
        ids: highlights.map((h) => h.id),
    };
    // The inspector now answers; no preview until the pointer moves on.
    peekMuted = true;
    hidePeek();
    renderLegend();
    renderInspector();
});

passage.on('select', ({ start, end, text }) => {
    window.getSelection()?.removeAllRanges();
    if (!text.trim()) return;
    const same = analyses.find((a) => a.start === start && a.end === end);
    if (same) {
        inspected = { kind: 'one', id: same.id };
        renderLegend();
        renderInspector();
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
                tone: ownTone(ownCount),
                own: true,
            },
        },
    ];
    inspected = { kind: 'one', id, added: true };
    sync();
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
                `<div class="row">${h.data ? swatch(h.data.tone) : ''}${esc(h.data?.label ?? h.id)}</div>`,
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
    analyses = analyses.filter((a) => a.id !== id);
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
        overlapPicked = true;
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

const WORDMARK_TONES: Tone[] = [
    { light: '#9cc3ff', dark: '#3a78e8' },
    { light: '#ffb3cf', dark: '#c45c86' },
];

function wordmarkHighlights(): Highlight[] {
    return [
        { id: 'overlap', start: 0, end: 7, color: paint(WORDMARK_TONES[0]!) },
        { id: 'lapmark', start: 4, end: 11, color: paint(WORDMARK_TONES[1]!) },
    ];
}

const wordmark = createHighlighter($('wordmark'), {
    text: 'overlapmark',
    highlights: wordmarkHighlights(),
    focusable: false,
    overlap: themeOverlap(),
});

// ---- styling showcase ----------------------------------------------------------

const SAMPLE =
    'Read it once for the argument, again for the evidence, and a third time for what the author leaves out.';

const SAMPLE_RANGES: { id: string; part: string; tone: Tone }[] = [
    { id: 's1', part: SAMPLE, tone: { light: '#5b9cff', dark: '#3a78e8' } },
    {
        id: 's2',
        part: 'for the argument, again',
        tone: { light: '#ff8fb8', dark: '#c45c86' },
    },
    {
        id: 's3',
        part: 'again for the evidence, and a third time for what the author leaves out',
        tone: { light: '#4fd49b', dark: '#1f9e6b' },
    },
    {
        id: 's4',
        part: 'a third time for what the author leaves out',
        tone: { light: '#b49bff', dark: '#8064e8' },
    },
    {
        id: 's5',
        part: 'what the author leaves out',
        tone: { light: '#ffa64d', dark: '#d9761c' },
    },
    {
        id: 's6',
        part: 'leaves out',
        tone: { light: '#ff7a7a', dark: '#d2453b' },
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
    return SAMPLE_RANGES.map(({ id, part, tone }) => {
        const start = SAMPLE.indexOf(part);
        return {
            id,
            start,
            end: start + part.length,
            color: paint(tone),
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

const tabs = [...document.querySelectorAll<HTMLElement>('[data-tab]')];
function showTab(name: string): void {
    for (const tab of tabs)
        tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    $('snippet').textContent = SNIPPETS[name] ?? '';
}
for (const tab of tabs)
    tab.addEventListener('click', () => showTab(tab.dataset.tab ?? ''));

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
    // Colors are data: each theme hands the highlighters its own fills.
    passage.update({ highlights: passageHighlights() });
    wordmark.update({ highlights: wordmarkHighlights() });
    sample.update({ highlights: sampleHighlights() });
    wordmark.update({ overlap: themeOverlap() });
    if (!overlapPicked) {
        overlap = themeOverlap();
        for (const input of radios('overlap'))
            input.checked = input.value === overlap;
        passage.update({ overlap });
        renderModes();
    }
    renderLegend();
    renderInspector();
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

darkQuery.addEventListener('change', applyTheme);

renderModes();
renderKnobs();
$('preset-explain').textContent = PRESET_EXPLAIN[''] ?? '';
showTab('vanilla');
applyTheme();
