import { describe, expect, it, onTestFinished } from 'vitest';
// pre-wrap on .om-root keeps Selection#toString faithful to whitespace.
import '../src/styles.css';
import {
    createRangeFromOffsets,
    getOffsetFromPoint,
    getSelectionOffsets,
    getTextLength,
} from '../src/dom';
import { isInsidePair } from '../src/unicode';
import {
    attach,
    mount,
    select,
    selectFromOutsideTo,
    setSelection,
} from './helpers/mount';

const text = 'Hello wonderful world 😀 하이라이트';
const hl = [
    { id: 'a', start: 0, end: 15 },
    { id: 'b', start: 6, end: 21 },
];
const strategies = ['layers', 'depth'] as const;

// The decoration is appended to the content of mark "b", i.e. at offset 15
// (the end of segment [6,15)).
const NOTE = '[note]';
const NOTE_OFFSET = 15;
const note = { id: 'b', text: NOTE };

function givenDecoratedRoot(): HTMLElement {
    return mount(text, hl, { decorate: note });
}

function givenForeignParagraph(): HTMLElement {
    const other = document.createElement('p');
    other.textContent = 'somewhere else';
    return attach(other);
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

/** Every [start, end) pair of `source` whose boundaries do not split a surrogate pair. */
function validRanges(source: string): [number, number][] {
    const pairs: [number, number][] = [];
    for (let s = 0; s < source.length; s++) {
        for (let e = s + 1; e <= source.length; e++) {
            if (!isInsidePair(source, s) && !isInsidePair(source, e))
                pairs.push([s, e]);
        }
    }
    return pairs;
}

describe('getSelectionOffsets', () => {
    it('maps a selection inside nested marks to string indices', () => {
        const root = mount(text, hl);

        select(root, 8, 18);

        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(text.slice(8, 18));
    });

    it.each(strategies)('maps a selection with the %s strategy', (strategy) => {
        const root = mount(text, hl, { strategy });

        select(root, 3, 20);

        expect(getSelectionOffsets(root)).toEqual({ start: 3, end: 20 });
    });

    it('reads an explicit Selection argument', () => {
        const root = mount(text, hl);
        select(root, 1, 4);

        expect(getSelectionOffsets(root, window.getSelection())).toEqual({
            start: 1,
            end: 4,
        });
    });

    it('falls back to the window selection when the Selection argument is null', () => {
        const root = mount(text, hl);
        select(root, 1, 4);

        expect(getSelectionOffsets(root, null)).toEqual({ start: 1, end: 4 });
    });

    it('maps a selectNodeContents range on a mark to the mark segment', () => {
        const root = mount(text, hl);
        const range = document.createRange();
        range.selectNodeContents(root.querySelector('[data-id="b"]')!);

        setSelection(range);

        expect(getSelectionOffsets(root)).toEqual({ start: 6, end: 15 });
    });

    it('maps a selectNodeContents range on the root to the whole text', () => {
        const root = mount(text, hl);
        const range = document.createRange();
        range.selectNodeContents(root);

        setSelection(range);

        expect(getSelectionOffsets(root)).toEqual({
            start: 0,
            end: text.length,
        });
    });

    it('maps boundaries expressed as child indices of the root', () => {
        const root = mount(text, hl);
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
            const root = mount(text, hl, {
                before: 'BEFORE ',
                after: ' AFTER',
            });

            selectFromOutsideTo(root, 5);

            expect(getSelectionOffsets(root)).toEqual({ start: 0, end: 5 });
        });

        it('clips a selection that ends after the root', () => {
            const root = mount(text, hl, {
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
            const root = mount(text, hl, {
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
            const root = mount(text, hl);
            window.getSelection()!.removeAllRanges();

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it('returns null for a collapsed selection inside the root', () => {
            const root = mount(text, hl);
            const collapsed = createRangeFromOffsets(root, 8, 8)!;
            expect(collapsed.collapsed).toBe(true);

            setSelection(collapsed);

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it('returns null for a selection entirely inside another element', () => {
            const root = mount(text, hl);
            const other = givenForeignParagraph();
            const foreign = document.createRange();
            foreign.selectNodeContents(other.firstChild!);

            setSelection(foreign);

            expect(getSelectionOffsets(root)).toBeNull();
        });

        it("returns null for a selection that ends exactly at the root's edge", () => {
            const root = mount(text, hl, { before: 'BEFORE ' });
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
            const root = mount(text, hl);
            const root2 = mount('another root', []);

            select(root, 2, 6);

            expect(getSelectionOffsets(root2)).toBeNull();
            expect(getSelectionOffsets(root)).toEqual({ start: 2, end: 6 });
        });
    });

    describe('with a data-om-skip decoration', () => {
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
            const root = mount(source, [{ id: 'x', start: 3, end: 12 }]);

            select(root, 3, 12);

            expect(getSelectionOffsets(root)).toEqual({ start: 3, end: 12 });
            expect(window.getSelection()!.toString()).toBe(source.slice(3, 12));
        });

        it('maps a selection of the whole text to string indices', () => {
            const root = mount(source, [{ id: 'x', start: 3, end: 12 }]);

            select(root, 0, source.length);

            expect(getSelectionOffsets(root)).toEqual({
                start: 0,
                end: source.length,
            });
        });
    });
});

describe('createRangeFromOffsets', () => {
    const variants = [
        { name: 'default rendering', options: {} },
        { name: 'depth strategy', options: { strategy: 'depth' as const } },
        { name: 'a data-om-skip decoration', options: { decorate: note } },
    ];

    describe.each(variants)('with $name', ({ options }) => {
        const ranges = validRanges(text);

        // A range that spans the decoration's position also spans its text.
        function expectedText(start: number, end: number): string {
            const crossesNote =
                'decorate' in options &&
                start < NOTE_OFFSET &&
                end > NOTE_OFFSET;
            return crossesNote
                ? text.slice(start, NOTE_OFFSET) +
                      NOTE +
                      text.slice(NOTE_OFFSET, end)
                : text.slice(start, end);
        }

        it('creates a range whose text matches the source slice for every start/end pair', () => {
            const root = mount(text, hl, options);

            for (const [start, end] of ranges) {
                const range = createRangeFromOffsets(root, start, end)!;
                expect(range.toString(), `${start}..${end}`).toBe(
                    expectedText(start, end),
                );
            }
        });

        it('maps the selected range back to the same offsets for every start/end pair', () => {
            const root = mount(text, hl, options);

            for (const [start, end] of ranges) {
                setSelection(createRangeFromOffsets(root, start, end)!);
                expect(getSelectionOffsets(root), `${start}..${end}`).toEqual({
                    start,
                    end,
                });
            }
        });
    });

    describe('with a data-om-skip decoration', () => {
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
        const root = mount(text, hl);

        expect(createRangeFromOffsets(root, -5, 5)!.toString()).toBe(
            text.slice(0, 5),
        );
    });

    it('clamps an end beyond the text to its length', () => {
        const root = mount(text, hl);

        expect(createRangeFromOffsets(root, 30, 999)!.toString()).toBe(
            text.slice(30),
        );
    });

    it('returns null for an inverted range', () => {
        const root = mount(text, hl);

        expect(createRangeFromOffsets(root, 5, 2)).toBeNull();
    });

    it('returns null for a NaN offset', () => {
        const root = mount(text, hl);

        expect(createRangeFromOffsets(root, Number.NaN, 2)).toBeNull();
    });

    it('creates a collapsed range inside an empty root', () => {
        const root = mount('', []);

        const range = createRangeFromOffsets(root, 0, 0)!;

        expect(range.collapsed).toBe(true);
        expect(root.contains(range.startContainer)).toBe(true);
    });
});

describe('getOffsetFromPoint', () => {
    it('returns the index of the character under the point', () => {
        const root = mount(text, hl);
        const r = createRangeFromOffsets(root, 10, 11)!.getBoundingClientRect();

        expect(getOffsetFromPoint(root, r.left + 1, r.top + r.height / 2)).toBe(
            10,
        );
    });

    it('treats the right half of a glyph as the same character, not the caret after it', () => {
        const root = mount(text, hl);
        const r = createRangeFromOffsets(root, 10, 11)!.getBoundingClientRect();

        expect(
            getOffsetFromPoint(root, r.right - 1, r.top + r.height / 2),
        ).toBe(10);
    });

    // 14 is the last char of segment [6,15); 15 the first of [15,21); 5 the last of [0,6).
    it.each([0, 5, 6, 14, 15, 20, 21])(
        'resolves character %i across segment boundaries',
        (index) => {
            const root = mount(text, hl);
            const { x, y, rect } = centerOf(root, index, index + 1);

            expect(getOffsetFromPoint(root, x, y)).toBe(index);
            expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(index);
        },
    );

    it('maps both halves of a surrogate-pair glyph to its first code unit', () => {
        const root = mount(text, hl);
        const emoji = text.indexOf('😀');
        const { y, rect } = centerOf(root, emoji, emoji + 2);

        expect(getOffsetFromPoint(root, rect.left + 1, y)).toBe(emoji);
        expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(emoji);
    });

    it('falls back to caretRangeFromPoint when caretPositionFromPoint is missing', () => {
        const root = mount(text, hl);
        const { x, y } = centerOf(root, 10, 11);
        Object.defineProperty(document, 'caretPositionFromPoint', {
            value: undefined,
            configurable: true,
        });
        onTestFinished(() => {
            delete (document as { caretPositionFromPoint?: unknown })
                .caretPositionFromPoint;
        });

        expect(getOffsetFromPoint(root, x, y)).toBe(10);
    });

    it('returns null for a point outside the root', () => {
        const root = mount(text, hl);
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
    it.each(strategies)(
        'equals the source text length with the %s strategy',
        (strategy) => {
            expect(getTextLength(mount(text, hl, { strategy }))).toBe(
                text.length,
            );
        },
    );

    it('equals the length of a plain unhighlighted text', () => {
        expect(getTextLength(mount('plain', []))).toBe(5);
    });

    it('is 0 for an empty root', () => {
        expect(getTextLength(mount('', []))).toBe(0);
    });
});
