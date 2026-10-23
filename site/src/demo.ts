import './fonts';
import '@overlapmark/core/styles.css';
import './site.css';
import './demo.css';
import type { Highlight } from '@overlapmark/core';
import { createHighlighter } from '@overlapmark/dom';
import { PALETTES } from './palette';
import { QUICK_STARTS } from './quick-starts';
import { SAMPLES, type Label } from './samples';
import { mountTabs } from './tabs';
import { randomWordRange, wordRanges } from './words';

const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as E;

// Hero: every press or selection adds one more mark.

const heroText = SAMPLES.hero.text;
const words = wordRanges(heroText);
let heroMarks = [...SAMPLES.hero.highlights];
let added = 0;
const hero = createHighlighter<Label>(byId('hero'), {
    text: heroText,
    highlights: heroMarks,
    // The hero only collects selections; section 02 shows keyboard access.
    focusable: false,
});
const status = byId('hero-status');

function showHero(arrived?: string): void {
    hero.update({ highlights: heroMarks });
    const deepest = Math.max(0, ...hero.getSegments().map((s) => s.depth));
    status.textContent = heroMarks.length
        ? `${heroMarks.length} highlights · deepest spot ${deepest} ${deepest === 1 ? 'layer' : 'layers'}`
        : 'No highlights. Press the button, or select any words.';
    if (arrived)
        for (const el of byId('hero').querySelectorAll(
            `[data-om-id="${arrived}"]`,
        ))
            el.classList.add('arrived');
}

function addHero(start: number, end: number): void {
    const id = `added-${++added}`;
    heroMarks = [
        ...heroMarks,
        {
            id,
            start,
            end,
            color: PALETTES.warm[
                (heroMarks.length + added) % PALETTES.warm.length
            ],
            data: { label: `Highlight ${heroMarks.length + 1}` },
        },
    ];
    showHero(id);
}

hero.on('select', ({ start, end }) => addHero(start, end));
byId('add').addEventListener('click', () => {
    const { start, end } = randomWordRange(words, Math.random);
    addHero(start, end);
});
byId('reset').addEventListener('click', () => {
    heroMarks = [];
    showHero();
});
showHero();

const install = byId<HTMLButtonElement>('install');
const INSTALL = install.textContent!.trim();
let restore = 0;
install.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(INSTALL);
        install.textContent = 'Copied';
        clearTimeout(restore);
        restore = window.setTimeout(
            () => (install.textContent = INSTALL),
            1200,
        );
    } catch {
        // Clipboard access denied: the command stays visible to copy by hand.
    }
});

// 01: the layers slider.

const layersInput = byId<HTMLInputElement>('layers');
const layers = createHighlighter<Label>(byId('layers-stage'), {
    ...SAMPLES.layers(Number(layersInput.value)),
    focusable: false,
});
layersInput.addEventListener('input', () => {
    const n = Number(layersInput.value);
    byId('layers-value').textContent = String(n);
    layers.update(SAMPLES.layers(n));
});

// 02: a click names every covering highlight.

const clickOut = byId('click-out');
const clicked = createHighlighter<Label>(byId('click-stage'), SAMPLES.passage);
clicked.on('click', ({ highlights }) => {
    const heading = document.createElement('b');
    heading.textContent = `${highlights.length} under the pointer`;
    clickOut.replaceChildren(heading, ...highlights.map(layerChip));
});

function layerChip(h: Highlight<Label>): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'chip layer';
    const swatch = document.createElement('i');
    swatch.className = 'swatch';
    swatch.style.background = h.color ?? '';
    chip.append(swatch, h.data?.label ?? h.id);
    return chip;
}

// 03: preset classes.

const PRESETS: [label: string, className: string][] = [
    ['Fill', ''],
    ['Marker', 'om-style-marker'],
    ['Underline', 'om-style-underline'],
    ['Box', 'om-style-box'],
];
const styled = createHighlighter<Label>(byId('style-stage'), {
    ...SAMPLES.styling,
    focusable: false,
});
const presetBar = byId('style-presets');
for (const [label, className] of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(className === ''));
    button.addEventListener('click', () => {
        for (const b of presetBar.children)
            b.setAttribute('aria-pressed', String(b === button));
        styled.update({
            highlights: SAMPLES.styling.highlights.map((h) =>
                className ? { ...h, className } : h,
            ),
        });
    });
    presetBar.append(button);
}

// 04: the README quick starts.

mountTabs(
    byId('frameworks'),
    Object.entries(QUICK_STARTS).map(([label, { lang, code }]) => ({
        label: label === 'vanilla JS' ? 'Vanilla' : label,
        lang,
        code,
    })),
);
