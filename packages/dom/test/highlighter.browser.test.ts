// createHighlighter behaviors outside the shared adapter contract, which
// highlighter.contract.browser.test.ts runs on it: replacing existing content,
// the shipped stylesheet, Node and null decorations, getSegments(),
// unsubscribing, what update() keeps when it re-renders everything, and
// destroy(). Nothing here waits a fixed time: tests await the real
// selectionchange or the mutation observers a re-render notifies, and the
// touch delay runs on fake timers.
import {
    TEXT,
    a,
    b,
    c,
    clearSelectionAndWait,
    givenFakeTimeouts,
    charPosition,
    givenPointerOutsideRoots,
    mutationsHandled,
    nextSelectionChange,
    partialOverlap,
    pointer,
    segmentElement,
    selectAndWait,
    selectEvent,
} from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import { computeSegments } from '@overlapmark/core';
import type { HoverDetail, SelectDetail } from '@overlapmark/core';
import { getSelectionOffsets } from '@overlapmark/core/dom';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createHighlighter } from '../src';
import type { Highlighter, HighlighterOptions } from '../src';

/** An element at the end of the body holding `content`; removed when the test finishes. */
function givenElement(content = ''): HTMLElement {
    const el = document.createElement('div');
    el.textContent = content;
    document.body.append(el);
    onTestFinished(() => el.remove());
    return el;
}

/**
 * A highlighter rendering `partialOverlap` unless `options` say otherwise.
 * Destroying it and clearing the selection are registered here.
 */
function givenHighlighter(options: Partial<HighlighterOptions> = {}): {
    el: HTMLElement;
    h: Highlighter;
} {
    const el = givenElement();
    const h = createHighlighter(el, {
        text: TEXT,
        highlights: partialOverlap.highlights,
        ...options,
    });
    onTestFinished(async () => {
        h.destroy();
        await clearSelectionAndWait();
    });
    return { el, h };
}

/** The alpha of a computed CSS color, normalized through a canvas (rgb, color(), oklab…). */
function alphaOf(css: string): number {
    const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    // A 1×1 image holds exactly four bytes.
    return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
}

describe('createHighlighter: rendering', () => {
    it('replaces the existing content of the element', () => {
        const el = givenElement('old content to be replaced');

        const h = createHighlighter(el, { text: TEXT, highlights: [a, b] });
        onTestFinished(() => h.destroy());

        expect(el.textContent).toBe(TEXT);
    });

    it('sets its own root class and strategy attribute over those the element had', () => {
        const el = givenElement();
        el.className = 'article';
        el.setAttribute('data-om-strategy', 'depth');

        const h = createHighlighter(el, { text: TEXT, highlights: [a] });
        onTestFinished(() => h.destroy());

        expect([...el.classList]).toEqual(['article', 'om-root']);
        expect(el.getAttribute('data-om-strategy')).toBe('layers');
    });

    it('paints highlights translucently with the shipped stylesheet', () => {
        const { el } = givenHighlighter();

        const mark = el.querySelector('mark[data-om-id="b"]')!;

        // Without the stylesheet Chromium paints <mark> opaque yellow.
        const alpha = alphaOf(getComputedStyle(mark).backgroundColor);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThan(1);
    });
});

// The adapter contract covers decorations given as text; these cover the
// other results decorate() may return.
describe('createHighlighter: decorate', () => {
    it('places a Node returned by decorate inside the decoration container', () => {
        const { el } = givenHighlighter({
            decorate: (segment) => {
                const badge = document.createElement('b');
                badge.textContent = String(segment.depth);
                return badge;
            },
        });

        const containers = [...el.querySelectorAll('[data-om-skip]')];

        expect(containers.map((c) => c.innerHTML)).toEqual([
            '<b>1</b>',
            '<b>2</b>',
            '<b>1</b>',
        ]);
        expect(containers.map((c) => c.getAttribute('aria-hidden'))).toEqual([
            'true',
            'true',
            'true',
        ]);
    });

    it.each([
        { label: 'null', nothing: null },
        { label: 'an empty string', nothing: '' },
    ])(
        'renders no decoration container for a segment decorate returns $label for',
        ({ nothing }) => {
            const { el } = givenHighlighter({
                decorate: (segment) =>
                    segment.depth > 1 ? 'overlap' : nothing,
            });

            const containers = [...el.querySelectorAll('[data-om-skip]')];

            // Live positive control: the overlapping segment is decorated.
            expect(containers.map((c) => c.textContent)).toEqual(['overlap']);
            expect(
                segmentElement(el, 0).querySelector('[data-om-skip]'),
            ).toBeNull();
        },
    );
});

describe('createHighlighter: getSegments()', () => {
    it('returns the segments of the text and highlights it rendered', () => {
        const { h } = givenHighlighter();

        expect(h.getSegments()).toEqual(computeSegments(TEXT, [a, b]));
    });

    it('returns the segments of the highlights given to update()', () => {
        const { h } = givenHighlighter();

        h.update({ highlights: [c] });

        expect(h.getSegments()).toEqual(computeSegments(TEXT, [c]));
    });
});

describe('createHighlighter: unsubscribing', () => {
    it('stops calling a subscriber once its unsubscribe function ran', () => {
        const { el, h } = givenHighlighter();
        const unsubscribed = vi.fn();
        const subscribed = vi.fn();
        const off = h.on('click', unsubscribed);
        h.on('click', subscribed);

        off();
        segmentElement(el, 6).click();

        expect(unsubscribed).not.toHaveBeenCalled();
        // Live positive control: the subscriber that stayed receives the click.
        expect(subscribed).toHaveBeenCalledTimes(1);
    });

    it('ignores a second call of an unsubscribe function', () => {
        const { el, h } = givenHighlighter();
        const subscribed = vi.fn();
        const off = h.on('click', vi.fn());
        h.on('click', subscribed);
        off();

        off();
        segmentElement(el, 6).click();

        expect(subscribed).toHaveBeenCalledTimes(1);
    });
    // Each on() is its own subscription, even for a function already subscribed.
    it('keeps calling a later subscription of the same function when an earlier unsubscribe runs again', () => {
        const { el, h } = givenHighlighter();
        const fn = vi.fn();
        const offEarlier = h.on('click', fn);
        offEarlier();
        h.on('click', fn);

        offEarlier();
        segmentElement(el, 6).click();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls a function subscribed twice once per subscription', () => {
        const { el, h } = givenHighlighter();
        const fn = vi.fn();
        h.on('click', fn);
        h.on('click', fn);

        segmentElement(el, 6).click();

        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('keeps the other subscription of a function subscribed twice when one is removed', () => {
        const { el, h } = givenHighlighter();
        const fn = vi.fn();
        const offFirst = h.on('click', fn);
        h.on('click', fn);

        offFirst();
        segmentElement(el, 6).click();

        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('createHighlighter: update() re-rendering a selection', () => {
    it('keeps the selection after the selectionchange its re-render causes', async () => {
        const { el, h } = givenHighlighter();
        await selectAndWait(el, 8, 18);
        const changed = nextSelectionChange();

        h.update({ highlights: [a, b, c] });
        await changed;

        expect(getSelectionOffsets(el)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(TEXT.slice(8, 18));
    });

    it('keeps a selection whose highlights are all removed', async () => {
        const { el, h } = givenHighlighter();
        await selectAndWait(el, 8, 18);

        h.update({ highlights: [] });

        expect(getSelectionOffsets(el)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(TEXT.slice(8, 18));
    });

    // A changed delay applies from the next selectionchange, and re-rendering
    // the selection is one, so a touch selection already waiting restarts its
    // wait with the new delay.
    it('restarts a pending touch wait with a changed touchSelectionDelay', async () => {
        const { el, h } = givenHighlighter({ touchSelectionDelay: 5000 });
        const selects: SelectDetail[] = [];
        h.on('select', (d) => selects.push(d));
        givenFakeTimeouts();
        pointer('pointerdown', el, { pointerType: 'touch' });
        await selectAndWait(el, 8, 18);
        const changed = nextSelectionChange();

        h.update({ touchSelectionDelay: 40 });
        await changed;

        vi.advanceTimersByTime(39);
        expect(selects).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(selects).toEqual([selectEvent(8, 18, [a, b]).detail]);
    });
});

describe('createHighlighter: update() re-rendering focus and hover', () => {
    it('moves focus to the re-rendered element of the focused segment', () => {
        const { el, h } = givenHighlighter();
        const before = segmentElement(el, 6);
        before.focus();

        h.update({ highlights: [a, b, c] });

        const after = segmentElement(el, 6);
        expect(after).not.toBe(before);
        expect(document.activeElement).toBe(after);
    });

    /**
     * Hovers character 12 of segment [6,15) a+b. After `update({ highlights:
     * [a, b, c] })` that character lies in [10,15) a+b+c, a different segment,
     * so core reports the leave once the update has re-rendered.
     */
    async function givenHoveredSegment(
        el: HTMLElement,
        h: Highlighter,
    ): Promise<HoverDetail[]> {
        await givenPointerOutsideRoots();
        const hovers: HoverDetail[] = [];
        h.on('hover', (d) => hovers.push(d));
        const { el: target, position } = charPosition(el, 12);
        await userEvent.hover(target, { position });
        return hovers;
    }

    // The hovered element is replaced, so the pointer can no longer leave it.
    it('emits leave for the hovered segment it re-renders, with no pointer event', async () => {
        const { el, h } = givenHighlighter();
        const hovers = await givenHoveredSegment(el, h);
        const handled = mutationsHandled(el);

        h.update({ highlights: [a, b, c] });
        await handled;

        expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(hovers[1]).toEqual({
            type: 'leave',
            segment: hovers[0]!.segment,
            highlights: [a, b],
            event: null,
        });
        expect(hovers[1]!.segment).toBe(hovers[0]!.segment);
    });

    it('does not emit that leave again when the pointer next moves', async () => {
        const { el, h } = givenHighlighter();
        const hovers = await givenHoveredSegment(el, h);
        const handled = mutationsHandled(el);
        h.update({ highlights: [a, b, c] });
        await handled;

        pointer('pointerover', segmentElement(el, 15));

        expect(hovers.map((d) => `${d.type}:${d.segment.start}`)).toEqual([
            'enter:6',
            'leave:6',
            'enter:15',
        ]);
    });

    it('does not emit that leave again on destroy', async () => {
        const { el, h } = givenHighlighter();
        const hovers = await givenHoveredSegment(el, h);
        const handled = mutationsHandled(el);
        h.update({ highlights: [a, b, c] });
        await handled;

        h.destroy();

        expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
    });
});

describe('createHighlighter: destroy()', () => {
    // The element survives destroy(), so a listener left on it would still
    // handle a segment-like element put back inside it.
    it('stops handling keys on the element', () => {
        const { el, h } = givenHighlighter();
        const space = (): KeyboardEvent =>
            new KeyboardEvent('keydown', {
                key: ' ',
                bubbles: true,
                cancelable: true,
            });
        const beforeDestroy = space();
        segmentElement(el, 6).dispatchEvent(beforeDestroy);
        expect(beforeDestroy.defaultPrevented).toBe(true);

        h.destroy();
        const lookalike = document.createElement('span');
        lookalike.setAttribute('data-om-start', '6');
        lookalike.setAttribute('tabindex', '0');
        el.append(lookalike);
        const afterDestroy = space();
        lookalike.dispatchEvent(afterDestroy);

        expect(afterDestroy.defaultPrevented).toBe(false);
    });

    it('leaves the element holding the plain text only', () => {
        const { el, h } = givenHighlighter();

        h.destroy();

        expect(el.childNodes).toHaveLength(1);
        expect(el.firstChild!.nodeType).toBe(Node.TEXT_NODE);
        expect(el.textContent).toBe(TEXT);
    });

    it('removes the root class and the strategy attribute', () => {
        const { el, h } = givenHighlighter();

        h.destroy();

        expect(el.hasAttribute('class')).toBe(false);
        expect(el.hasAttribute('data-om-strategy')).toBe(false);
    });

    it('removes the overlap attribute and the root style it set, and keeps the element style', () => {
        const el = givenElement();
        el.style.color = 'navy';
        const h = createHighlighter(el, {
            text: TEXT,
            highlights: [a],
            defaultColor: '#123456',
        });
        expect(el.style.getPropertyValue('--om-default-color')).toBe('#123456');

        h.destroy();

        expect(el.hasAttribute('data-om-overlap')).toBe(false);
        expect(el.style.getPropertyValue('--om-default-color')).toBe('');
        expect(el.style.color).toBe('navy');
    });

    it('ignores update() after destroy()', () => {
        const { el, h } = givenHighlighter();
        h.destroy();

        h.update({ highlights: [c] });

        expect(el.childNodes).toHaveLength(1);
        expect(el.firstChild!.nodeType).toBe(Node.TEXT_NODE);
        expect(el.hasAttribute('class')).toBe(false);
    });

    it('leaves the element alone when called again', () => {
        const { el, h } = givenHighlighter();
        h.destroy();
        el.textContent = 'content the page put back';

        h.destroy();

        expect(el.textContent).toBe('content the page put back');
    });
});
