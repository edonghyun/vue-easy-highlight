import { codePointRanges, setSelection } from '@overlapmark/adapter-contract';
import { describe, expect, it, onTestFinished } from 'vitest';
// pre-wrap on .om-root keeps Selection#toString faithful to whitespace.
import '../src/styles.css';
import {
    createRangeFromOffsets,
    getOffsetFromPoint,
    getSelectionOffsets,
    getTextLength,
} from '../src/dom';
import {
    givenFrameDocument,
    givenInDocument,
    givenRenderedRoot,
    givenRenderedRootIn,
    givenShadowRoot,
    select,
    selectFromOutsideTo,
} from './helpers/mount';

const text = 'Hello wonderful world 😀 하이라이트';
const hl = [
    { id: 'a', start: 0, end: 15 },
    { id: 'b', start: 6, end: 21 },
];

// The decoration is appended to the content of mark "b", i.e. at offset 15
// (the end of segment [6,15)).
const NOTE = '[note]';
const NOTE_OFFSET = 15;
const note = { id: 'b', text: NOTE };

function givenDecoratedRoot(): HTMLElement {
    const root = givenRenderedRoot(text, hl, { decorate: note });
    // Precondition: the decoration exists, so tests of its absence are meaningful.
    expect(root.querySelector('[data-om-skip]')).not.toBeNull();
    return root;
}

function givenForeignParagraph(): HTMLElement {
    const other = document.createElement('p');
    other.textContent = 'somewhere else';
    return givenInDocument(other);
}

function centerOf(
    root: Element,
    start: number,
    end: number,
): { x: number; y: number; rect: DOMRect } {
    const rect = createRangeFromOffsets(
        root,
        start,
        end,
    )!.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rect,
    };
}

/** The boundary point right after the host of `shadow`, in the host's parent. */
function afterHost(shadow: ShadowRoot): [Node, number] {
    const parent = shadow.host.parentNode!;
    return [parent, [...parent.childNodes].indexOf(shadow.host) + 1];
}

describe('getSelectionOffsets', () => {
    it('reads an explicit Selection argument', () => {
        const root = givenRenderedRoot(text, hl);
        select(root, 1, 4);

        expect(getSelectionOffsets(root, window.getSelection())).toEqual({
            start: 1,
            end: 4,
        });
    });

    it('falls back to the window selection when the Selection argument is null', () => {
        const root = givenRenderedRoot(text, hl);
        select(root, 1, 4);

        expect(getSelectionOffsets(root, null)).toEqual({ start: 1, end: 4 });
    });

    it('maps a selectNodeContents range on a mark to the mark segment', () => {
        const root = givenRenderedRoot(text, hl);
        const range = document.createRange();
        range.selectNodeContents(root.querySelector('[data-om-id="b"]')!);

        setSelection(range);

        expect(getSelectionOffsets(root)).toEqual({ start: 6, end: 15 });
    });

    it('maps a selectNodeContents range on the root to the whole text', () => {
        const root = givenRenderedRoot(text, hl);
        const range = document.createRange();
        range.selectNodeContents(root);

        setSelection(range);

        expect(getSelectionOffsets(root)).toEqual({
            start: 0,
            end: text.length,
        });
    });

    it('maps boundaries expressed as child indices of the root', () => {
        const root = givenRenderedRoot(text, hl);
        // Segments [6,15) and [15,21) are adjacent children of the root.
        const index = [...root.children].findIndex(
            (el) => el.getAttribute('data-om-start') === '6',
        );
        const range = document.createRange();
        range.setStart(root, index);
        range.setEnd(root, index + 2);

        setSelection(range);

        expect(getSelectionOffsets(root)).toEqual({ start: 6, end: 21 });
    });

    describe('when the selection extends outside the root', () => {
        it('clips a selection that starts before the root', () => {
            const root = givenRenderedRoot(text, hl, {
                before: 'BEFORE ',
                after: ' AFTER',
            });

            selectFromOutsideTo(root, 5);

            expect(getSelectionOffsets(root)).toEqual({ start: 0, end: 5 });
        });

        it('clips a selection that ends after the root', () => {
            const root = givenRenderedRoot(text, hl, {
                before: 'BEFORE ',
                after: ' AFTER',
            });
            const inner = createRangeFromOffsets(root, 22, 22)!;
            const range = document.createRange();
            range.setStart(inner.startContainer, inner.startOffset);
            range.setEnd(root.nextSibling!, 3);

            setSelection(range);

            expect(getSelectionOffsets(root)).toEqual({
                start: 22,
                end: text.length,
            });
        });

        it('clips a selection that starts before and ends after the root', () => {
            const root = givenRenderedRoot(text, hl, {
                before: 'BEFORE ',
                after: ' AFTER',
            });
            const range = document.createRange();
            range.setStart(root.previousSibling!, 2);
            range.setEnd(root.nextSibling!, 2);

            setSelection(range);

            expect(getSelectionOffsets(root)).toEqual({
                start: 0,
                end: text.length,
            });
        });
    });

    describe('when there is no selection inside the root', () => {
        it('returns null when nothing is selected', () => {
            const root = givenRenderedRoot(text, hl);
            window.getSelection()!.removeAllRanges();

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it('returns null for a collapsed selection inside the root', () => {
            const root = givenRenderedRoot(text, hl);
            const collapsed = createRangeFromOffsets(root, 8, 8)!;
            expect(collapsed.collapsed).toBe(true);

            setSelection(collapsed);

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it('returns null for a selection entirely inside another element', () => {
            const root = givenRenderedRoot(text, hl);
            const other = givenForeignParagraph();
            const foreign = document.createRange();
            foreign.selectNodeContents(other.firstChild!);

            setSelection(foreign);

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it("returns null for a selection that ends exactly at the root's edge", () => {
            const root = givenRenderedRoot(text, hl, { before: 'BEFORE ' });
            const touching = document.createRange();
            touching.setStart(root.previousSibling!, 0);
            touching.setEnd(
                document.body,
                [...document.body.childNodes].indexOf(root),
            );

            setSelection(touching);

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it("does not report one root's selection to a second root", () => {
            const root = givenRenderedRoot(text, hl);
            const root2 = givenRenderedRoot('another root', []);

            select(root, 2, 6);

            expect(getSelectionOffsets(root2)).toBeNull();
            expect(getSelectionOffsets(root)).toEqual({ start: 2, end: 6 });
        });
        it('returns no offsets for a root that is not in the document while the page has a selection', () => {
            const attached = givenRenderedRoot(text, hl);
            const detached = attached.cloneNode(true) as HTMLElement;
            select(attached, 2, 6);

            const offsets = getSelectionOffsets(detached);

            expect(offsets).toBeNull();
            // Live positive control: the same selection, on the root in the document.
            expect(getSelectionOffsets(attached)).toEqual({ start: 2, end: 6 });
        });

        it('returns no offsets for the selection of another document', () => {
            const page = givenRenderedRoot(text, hl);
            const framed = givenRenderedRootIn(
                givenFrameDocument().body,
                text,
                hl,
            );
            select(page, 2, 6);

            const offsets = getSelectionOffsets(framed, window.getSelection());

            expect(offsets).toBeNull();
            // Live positive control: the same selection, on the root it is in.
            expect(getSelectionOffsets(page, window.getSelection())).toEqual({
                start: 2,
                end: 6,
            });
        });
    });

    describe('for a root inside a shadow root', () => {
        it('maps a selection inside the root', () => {
            const root = givenRenderedRootIn(givenShadowRoot(), text, hl);

            select(root, 8, 18);

            expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        });

        // As in Chromium before 137, which has no getComposedRanges.
        it('maps a selection inside the root where getComposedRanges is missing', () => {
            const root = givenRenderedRootIn(givenShadowRoot(), text, hl);
            select(root, 8, 18);
            const selection = window.getSelection()!;
            Object.defineProperty(selection, 'getComposedRanges', {
                value: undefined,
                configurable: true,
            });
            onTestFinished(() => {
                delete (selection as { getComposedRanges?: unknown })
                    .getComposedRanges;
            });
            expect(window.getSelection()!.getComposedRanges).toBeUndefined();

            expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        });

        it('clips a selection that starts outside the shadow root', () => {
            const outside = givenInDocument(document.createTextNode('BEFORE '));
            const root = givenRenderedRootIn(givenShadowRoot(), text, hl);
            const inner = createRangeFromOffsets(root, 0, 8)!;

            window
                .getSelection()!
                .setBaseAndExtent(
                    outside,
                    0,
                    inner.endContainer,
                    inner.endOffset,
                );

            expect(getSelectionOffsets(root)).toEqual({ start: 0, end: 8 });
        });

        it('clips a selection that ends right after the shadow host', () => {
            const shadow = givenShadowRoot();
            const root = givenRenderedRootIn(shadow, text, hl);
            const inner = createRangeFromOffsets(root, 8, 8)!;

            window
                .getSelection()!
                .setBaseAndExtent(
                    inner.startContainer,
                    inner.startOffset,
                    ...afterHost(shadow),
                );

            expect(getSelectionOffsets(root)).toEqual({
                start: 8,
                end: text.length,
            });
        });

        it('returns no offsets for a selection that starts right after the shadow host', () => {
            const shadow = givenShadowRoot();
            const root = givenRenderedRootIn(shadow, text, hl);
            const after = givenInDocument(document.createTextNode(' AFTER'));

            window
                .getSelection()!
                .setBaseAndExtent(...afterHost(shadow), after, 3);

            expect(getSelectionOffsets(root)).toBeNull();
            // Live positive control: the same end, from a start inside the root.
            const inner = createRangeFromOffsets(root, 8, 8)!;
            window
                .getSelection()!
                .setBaseAndExtent(
                    inner.startContainer,
                    inner.startOffset,
                    after,
                    3,
                );
            expect(getSelectionOffsets(root)).toEqual({
                start: 8,
                end: text.length,
            });
        });

        it('maps select-all to the whole text when the shadow host is the last child', () => {
            const shadow = givenShadowRoot();
            const root = givenRenderedRootIn(shadow, text, hl);
            expect(document.body.lastChild).toBe(shadow.host);

            window.getSelection()!.selectAllChildren(document.body);

            expect(getSelectionOffsets(root)).toEqual({
                start: 0,
                end: text.length,
            });
        });
    });

    describe('for a root inside an iframe', () => {
        it("maps a selection inside the root, read from the iframe's own window", () => {
            const root = givenRenderedRootIn(
                givenFrameDocument().body,
                text,
                hl,
            );

            select(root, 8, 18);

            expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        });
    });

    describe('with a data-om-skip decoration at offset 15', () => {
        it('ignores the decoration text when mapping a selection', () => {
            const root = givenDecoratedRoot();

            select(root, 8, 18);

            expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        });

        it('does not count the decoration text in the text length', () => {
            const root = givenDecoratedRoot();

            expect(getTextLength(root)).toBe(text.length);
        });

        it('resolves a boundary placed inside the decoration to where it sits', () => {
            const root = givenDecoratedRoot();
            const deco = root.querySelector('[data-om-skip]')!;
            const end = createRangeFromOffsets(root, 18, 18)!;
            const range = document.createRange();
            range.setStart(deco.firstChild!, 2);
            range.setEnd(end.startContainer, end.startOffset);

            setSelection(range);

            expect(getSelectionOffsets(root)).toEqual({
                start: NOTE_OFFSET,
                end: 18,
            });
        });
    });

    describe('with CRLF, tabs and leading spaces', () => {
        const source = '\n  first\r\n\tsecond  ';

        it('maps a partial selection to string indices', () => {
            const root = givenRenderedRoot(source, [
                { id: 'x', start: 3, end: 12 },
            ]);

            select(root, 3, 12);

            expect(getSelectionOffsets(root)).toEqual({ start: 3, end: 12 });
            expect(window.getSelection()!.toString()).toBe(source.slice(3, 12));
        });

        it('maps a selection of the whole text to string indices', () => {
            const root = givenRenderedRoot(source, [
                { id: 'x', start: 3, end: 12 },
            ]);

            select(root, 0, source.length);

            expect(getSelectionOffsets(root)).toEqual({
                start: 0,
                end: source.length,
            });
        });
    });
});

describe('createRangeFromOffsets', () => {
    // A range that spans the decoration's position also spans its text.
    const spanTextWithNote = (start: number, end: number) =>
        start < NOTE_OFFSET && end > NOTE_OFFSET
            ? text.slice(start, NOTE_OFFSET) +
              NOTE +
              text.slice(NOTE_OFFSET, end)
            : text.slice(start, end);

    describe('with a data-om-skip decoration at offset 15', () => {
        const ranges = codePointRanges(text);

        it('creates a range whose text matches the source slice for every start/end pair', () => {
            const root = givenDecoratedRoot();
            expect(ranges.length).toBeGreaterThan(0);

            for (const [start, end] of ranges) {
                const range = createRangeFromOffsets(root, start, end)!;
                expect(range.toString(), `${start}..${end}`).toBe(
                    spanTextWithNote(start, end),
                );
            }
        });

        it('maps the selected range back to the same offsets for every start/end pair', () => {
            const root = givenDecoratedRoot();
            expect(ranges.length).toBeGreaterThan(0);

            for (const [start, end] of ranges) {
                setSelection(createRangeFromOffsets(root, start, end)!);
                expect(getSelectionOffsets(root), `${start}..${end}`).toEqual({
                    start,
                    end,
                });
            }
        });

        it('excludes the decoration text from a range that ends where it sits', () => {
            const root = givenDecoratedRoot();

            expect(
                createRangeFromOffsets(root, 6, NOTE_OFFSET)!.toString(),
            ).toBe('wonderful');
        });

        it('excludes the decoration text from a range that starts where it sits', () => {
            const root = givenDecoratedRoot();

            expect(
                createRangeFromOffsets(root, NOTE_OFFSET, 21)!.toString(),
            ).toBe(' world');
        });
    });

    it('clamps a negative start to 0', () => {
        const root = givenRenderedRoot(text, hl);

        expect(createRangeFromOffsets(root, -5, 5)!.toString()).toBe(
            text.slice(0, 5),
        );
    });

    it('clamps an end beyond the text to its length', () => {
        const root = givenRenderedRoot(text, hl);

        expect(createRangeFromOffsets(root, 30, 999)!.toString()).toBe(
            text.slice(30),
        );
    });

    it('returns null for an inverted range', () => {
        const root = givenRenderedRoot(text, hl);

        expect(createRangeFromOffsets(root, 5, 2)).toBeNull();
    });

    it('returns null for a NaN offset', () => {
        const root = givenRenderedRoot(text, hl);

        expect(createRangeFromOffsets(root, Number.NaN, 2)).toBeNull();
    });

    it('creates a collapsed range inside an empty root', () => {
        const root = givenRenderedRoot('', []);

        const range = createRangeFromOffsets(root, 0, 0)!;

        expect(range.collapsed).toBe(true);
        expect(root.contains(range.startContainer)).toBe(true);
    });
});

describe('getOffsetFromPoint', () => {
    it('returns the index of the character under the point', () => {
        const root = givenRenderedRoot(text, hl);
        const r = createRangeFromOffsets(root, 10, 11)!.getBoundingClientRect();

        expect(getOffsetFromPoint(root, r.left + 1, r.top + r.height / 2)).toBe(
            10,
        );
    });

    it('treats the right half of a glyph as the same character, not the caret after it', () => {
        const root = givenRenderedRoot(text, hl);
        const r = createRangeFromOffsets(root, 10, 11)!.getBoundingClientRect();

        expect(
            getOffsetFromPoint(root, r.right - 1, r.top + r.height / 2),
        ).toBe(10);
    });

    // 14 is the last char of segment [6,15); 15 the first of [15,21); 5 the last of [0,6).
    it.each([0, 5, 6, 14, 15, 20, 21])(
        'resolves character %i across segment boundaries',
        (index) => {
            const root = givenRenderedRoot(text, hl);
            const { x, y, rect } = centerOf(root, index, index + 1);

            expect(getOffsetFromPoint(root, x, y)).toBe(index);
            expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(index);
        },
    );

    it('maps both halves of a surrogate-pair glyph to its first code unit', () => {
        const root = givenRenderedRoot(text, hl);
        const emoji = text.indexOf('😀');
        const { y, rect } = centerOf(root, emoji, emoji + 2);

        expect(getOffsetFromPoint(root, rect.left + 1, y)).toBe(emoji);
        expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(emoji);
    });

    it('falls back to caretRangeFromPoint when caretPositionFromPoint is missing', () => {
        const root = givenRenderedRoot(text, hl);
        const { x, y } = centerOf(root, 10, 11);
        Object.defineProperty(document, 'caretPositionFromPoint', {
            value: undefined,
            configurable: true,
        });
        onTestFinished(() => {
            delete (document as { caretPositionFromPoint?: unknown })
                .caretPositionFromPoint;
        });
        expect(document.caretPositionFromPoint).toBeUndefined();

        expect(getOffsetFromPoint(root, x, y)).toBe(10);
    });

    it('returns the index of the character under the point for a root inside a shadow root', () => {
        const root = givenRenderedRootIn(givenShadowRoot(), text, hl);
        const { x, y } = centerOf(root, 10, 11);

        expect(getOffsetFromPoint(root, x, y)).toBe(10);
    });

    it('returns the index of the character under the point for a root inside an iframe', () => {
        const root = givenRenderedRootIn(givenFrameDocument().body, text, hl);
        // In the iframe's viewport, as its own events report points.
        const { x, y } = centerOf(root, 10, 11);

        expect(getOffsetFromPoint(root, x, y)).toBe(10);
    });

    it('returns null for a point outside the root', () => {
        const root = givenRenderedRoot(text, hl);
        const other = givenForeignParagraph();
        const o = other.getBoundingClientRect();

        expect(
            getOffsetFromPoint(root, o.left + 2, o.top + o.height / 2),
        ).toBeNull();
    });

    it.each([
        ['left edge', (d: DOMRect) => d.left + 1],
        ['center', (d: DOMRect) => d.left + d.width / 2],
        ['right edge', (d: DOMRect) => d.right - 1],
    ])('returns null on the %s of a skip decoration', (_, xOf) => {
        const root = givenDecoratedRoot();
        const d = root.querySelector('[data-om-skip]')!.getBoundingClientRect();

        expect(
            getOffsetFromPoint(root, xOf(d), d.top + d.height / 2),
        ).toBeNull();
    });
});

describe('getTextLength', () => {
    it('equals the length of a plain unhighlighted text', () => {
        expect(getTextLength(givenRenderedRoot('plain', []))).toBe(5);
    });

    it('is 0 for an empty root', () => {
        expect(getTextLength(givenRenderedRoot('', []))).toBe(0);
    });
});
