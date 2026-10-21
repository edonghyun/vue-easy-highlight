// captureViewState / restoreViewState on a root re-rendered from scratch by
// renderInto, the way the dom adapter re-renders. The adapter contract runs
// the same rules through each adapter's update(); these tests pin the rules
// themselves, including the cases no update() call can set up.
import {
    REPLACED_TEXT,
    TEXT,
    a,
    b,
    c,
    segmentElement,
    setSelection,
} from '@overlapmark/adapter-contract';
import { describe, expect, it } from 'vitest';
import '../src/styles.css';
import type { Highlight, RenderOptions } from '../src';
import {
    captureViewState,
    getSelectionOffsets,
    restoreViewState,
} from '../src/dom';
import {
    givenInDocument,
    givenRenderedRoot,
    renderInto,
    select,
} from './helpers/mount';

/** Re-renders `root` from scratch around a capture/restore, as an adapter update does. */
function reRender(
    root: HTMLElement,
    next: { text?: string; highlights: readonly Highlight[] } & RenderOptions,
): void {
    const text = next.text ?? TEXT;
    const view = captureViewState(root);

    renderInto(root, text, next.highlights, next);

    restoreViewState(root, view, { textChanged: text !== TEXT });
}

describe('restoreViewState: selection', () => {
    it('puts the selection back at the same text offsets', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        select(root, 8, 18);

        reRender(root, { highlights: [a, b, c] });

        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(TEXT.slice(8, 18));
    });

    it('clears the selection when the text changed', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        select(root, 8, 18);

        reRender(root, { text: REPLACED_TEXT, highlights: [a, b] });

        expect(window.getSelection()!.rangeCount).toBe(0);
    });

    it('leaves a selection outside the root untouched when the text changed', () => {
        const root = givenRenderedRoot(TEXT, [a, b], { before: 'outside' });
        const outside = root.previousSibling!;
        const range = document.createRange();
        range.setStart(outside, 0);
        range.setEnd(outside, 7);
        setSelection(range);

        reRender(root, { text: REPLACED_TEXT, highlights: [a, b] });

        expect(window.getSelection()!.toString()).toBe('outside');
    });
});

describe('restoreViewState: focus', () => {
    it('focuses the re-rendered element of the focused segment', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        const before = segmentElement(root, 6);
        before.focus();

        reRender(root, { highlights: [a, b, c] });

        expect(document.activeElement).not.toBe(before);
        expect(document.activeElement).toBe(segmentElement(root, 6));
    });

    it('focuses the highlighted segment now covering the start of the focused one', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        segmentElement(root, 6).focus();

        reRender(root, { highlights: [a] });

        expect(document.activeElement).toBe(segmentElement(root, 0));
    });

    it('moves focus nowhere when a plain segment now covers that start', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        segmentElement(root, 6).focus();

        reRender(root, { highlights: [c] });

        expect(segmentElement(root, 0).hasAttribute('data-depth')).toBe(false);
        expect(root.contains(document.activeElement)).toBe(false);
    });

    it('moves focus nowhere when the covering segment is not focusable', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        segmentElement(root, 6).focus();

        reRender(root, { highlights: [a], focusable: false });

        expect(segmentElement(root, 0).hasAttribute('data-depth')).toBe(true);
        expect(root.contains(document.activeElement)).toBe(false);
    });

    it('leaves focus outside the root where it is', () => {
        const root = givenRenderedRoot(TEXT, [a, b]);
        const button = givenInDocument(document.createElement('button'));
        button.focus();

        reRender(root, { highlights: [a, b, c] });

        expect(document.activeElement).toBe(button);
    });
});
