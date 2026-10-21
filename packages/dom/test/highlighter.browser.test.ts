import { afterEach, describe, expect, it, vi } from 'vitest';
import '@overlapmark/core/styles.css';
import { computeSegments, segmentElements } from '@overlapmark/core';
import type { Highlight } from '@overlapmark/core';
import {
    createRangeFromOffsets,
    getSelectionOffsets,
} from '@overlapmark/core/dom';
import { createHighlighter } from '../src';
import type { Highlighter } from '../src';

const text = 'Hello wonderful world 😀 하이라이트';
const a: Highlight = { id: 'a', start: 0, end: 15 };
const b: Highlight = { id: 'b', start: 6, end: 21 };
const c: Highlight = { id: 'c', start: 10, end: 24 };

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const created: Highlighter[] = [];

function make(
    highlights: Highlight[] = [a, b],
    extra: Record<string, unknown> = {},
): { el: HTMLElement; h: Highlighter } {
    const el = document.createElement('div');
    el.textContent = 'old content to be replaced';
    document.body.appendChild(el);
    const h = createHighlighter(el, { text, highlights, ...extra });
    created.push(h);
    return { el, h };
}

function select(el: Element, start: number, end: number): void {
    const range = createRangeFromOffsets(el, start, end)!;
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
}

afterEach(() => {
    while (created.length) created.pop()!.destroy();
    window.getSelection()?.removeAllRanges();
    document.body.textContent = '';
});

describe('createHighlighter', () => {
    it('renders text once and matches the core DOM contract', () => {
        const { el, h } = make();
        const segs = computeSegments(text, [a, b]);
        expect(el.textContent).toBe(text);
        expect(el.querySelectorAll('[data-om-start]')).toHaveLength(
            segs.length,
        );
        expect(h.getSegments()).toHaveLength(segs.length);
        expect(el.classList.contains('om-root')).toBe(true);
        expect(el.getAttribute('data-om-strategy')).toBe('layers');
        const overlap = segs.find((s) => s.depth === 2)!;
        const specs = segmentElements(overlap);
        const outer = el.querySelector(`[data-om-start="${overlap.start}"]`)!;
        expect(outer.tagName.toLowerCase()).toBe(specs[0].tag);
        for (const [k, v] of Object.entries(specs[0].attrs))
            expect(outer.getAttribute(k)).toBe(v);
        expect(outer.querySelectorAll('mark')).toHaveLength(1);
    });

    it('on("click") receives covering highlights; off() stops it', async () => {
        const { el, h } = make();
        const fn = vi.fn();
        const off = h.on('click', fn);
        const target = el.querySelector<HTMLElement>('[data-id="b"]')!;
        target.click();
        await tick();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(
            fn.mock.calls[0][0].highlights.map((x: Highlight) => x.id),
        ).toEqual(['a', 'b']);
        off();
        target.click();
        await tick();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('update() replaces highlights and re-renders', () => {
        const { el, h } = make();
        h.update({ highlights: [c] });
        expect(el.textContent).toBe(text);
        expect(el.querySelector('[data-id="a"]')).toBeNull();
        expect(el.querySelector('[data-id="c"]')).not.toBeNull();
        expect(
            h.getSegments().flatMap((s) => s.highlights.map((x) => x.id)),
        ).toEqual(['c']);
    });

    it('update() switching strategy to depth renders one mark per segment', () => {
        const { el, h } = make();
        h.update({ strategy: 'depth' });
        expect(el.getAttribute('data-om-strategy')).toBe('depth');
        const marks = el.querySelectorAll('mark');
        const highlighted = h.getSegments().filter((s) => s.depth > 0);
        expect(marks).toHaveLength(highlighted.length);
        expect(el.querySelectorAll('mark mark')).toHaveLength(0);
    });

    it('keeps the user selection across update()', async () => {
        const { el, h } = make();
        select(el, 8, 18);
        h.update({ highlights: [a, b, c] });
        expect(getSelectionOffsets(el)).toMatchObject({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(text.slice(8, 18));
        await tick();
        expect(getSelectionOffsets(el)).toMatchObject({ start: 8, end: 18 });
    });

    it('restores focus to the same segment after update()', () => {
        const { el, h } = make();
        const before = el.querySelector<HTMLElement>('[data-om-start="6"]')!;
        before.focus();
        expect(document.activeElement).toBe(before);
        h.update({ highlights: [a, b, c] });
        const after = el.querySelector<HTMLElement>('[data-om-start="6"]')!;
        expect(after).not.toBe(before);
        expect(document.activeElement).toBe(after);
    });

    it('destroy() leaves plain text and removes listeners', async () => {
        const { el, h } = make();
        const fn = vi.fn();
        h.on('click', fn);
        const target = el.querySelector<HTMLElement>('[data-id="b"]')!;
        h.destroy();
        expect(el.childNodes).toHaveLength(1);
        expect(el.firstChild!.nodeType).toBe(Node.TEXT_NODE);
        expect(el.textContent).toBe(text);
        expect(el.hasAttribute('class')).toBe(false);
        expect(el.hasAttribute('data-om-strategy')).toBe(false);
        target.click();
        el.click();
        await tick();
        expect(fn).not.toHaveBeenCalled();
    });

    it('works with the shipped stylesheet', () => {
        const { el } = make();
        const layered = el.querySelector('[data-id="b"]')!;
        expect(getComputedStyle(layered).backgroundColor).not.toBe(
            'rgba(0, 0, 0, 0)',
        );
    });
});

describe('createHighlighter: interaction options', () => {
    it('update({ minSelectionLength }) takes effect and keeps subscriptions', async () => {
        const { el, h } = make([a, b], { minSelectionLength: 5 });
        const fn = vi.fn();
        h.on('select', fn);
        select(el, 2, 4);
        document.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true }),
        );
        await tick();
        expect(fn).not.toHaveBeenCalled();

        h.update({ minSelectionLength: 1 });
        select(el, 2, 4);
        document.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true }),
        );
        await tick();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0]).toMatchObject({ start: 2, end: 4 });
    });

    it('update({ touchSelectionDelay }) applies to a touch selection already in progress', async () => {
        const { el, h } = make([a, b], { touchSelectionDelay: 5000 });
        const fn = vi.fn();
        h.on('select', fn);
        el.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                pointerType: 'touch',
            }),
        );
        select(el, 8, 18);
        h.update({ touchSelectionDelay: 40 });
        await tick(10);
        expect(fn).not.toHaveBeenCalled();
        await tick(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0]).toMatchObject({ start: 8, end: 18 });
    });
});
