import { afterEach, describe, expect, it } from 'vitest';
// pre-wrap on .om-root keeps Selection#toString faithful to whitespace.
import '../src/styles.css';
import {
    createRangeFromOffsets,
    getOffsetFromPoint,
    getSelectionOffsets,
    getTextLength,
} from '../src/dom';
import {
    isLowSurrogateAt,
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

afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.textContent = '';
});

describe('getSelectionOffsets', () => {
    it('maps a selection inside nested marks to string indices', () => {
        const root = mount(text, hl);
        select(root, 8, 18);
        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.toString()).toBe(text.slice(8, 18));
    });

    it('works for both render strategies', () => {
        for (const strategy of ['layers', 'depth'] as const) {
            const root = mount(text, hl, { strategy });
            select(root, 3, 20);
            expect(getSelectionOffsets(root)).toEqual({ start: 3, end: 20 });
            root.remove();
        }
    });

    it('accepts an explicit Selection argument', () => {
        const root = mount(text, hl);
        select(root, 1, 4);
        expect(getSelectionOffsets(root, window.getSelection())).toEqual({
            start: 1,
            end: 4,
        });
        expect(getSelectionOffsets(root, null)).toEqual({ start: 1, end: 4 });
    });

    it('handles element-container boundaries (selectNodeContents on a mark)', () => {
        const root = mount(text, hl);
        const r = document.createRange();
        r.selectNodeContents(root.querySelector('[data-id="b"]')!);
        setSelection(r);
        expect(getSelectionOffsets(root)).toEqual({ start: 6, end: 15 });
    });

    it('handles element-container boundaries on the root and on plain segments', () => {
        const root = mount(text, hl);
        const all = document.createRange();
        all.selectNodeContents(root);
        setSelection(all);
        expect(getSelectionOffsets(root)).toEqual({
            start: 0,
            end: text.length,
        });

        // Boundaries expressed as child indices of the root: segments [6,15) and [15,21).
        const segs = [...root.children];
        const idx = segs.findIndex(
            (el) => el.getAttribute('data-om-start') === '6',
        );
        const r = document.createRange();
        r.setStart(root, idx);
        r.setEnd(root, idx + 2);
        setSelection(r);
        expect(getSelectionOffsets(root)).toEqual({ start: 6, end: 21 });
    });

    it('clips selections that extend outside the root', () => {
        const root = mount(text, hl, { before: 'BEFORE ', after: ' AFTER' });
        selectFromOutsideTo(root, 5);
        expect(getSelectionOffsets(root)).toEqual({ start: 0, end: 5 });

        const r = document.createRange();
        r.setStart(
            createRangeFromOffsets(root, 22, 22)!.startContainer,
            createRangeFromOffsets(root, 22, 22)!.startOffset,
        );
        r.setEnd(root.nextSibling!, 3);
        setSelection(r);
        expect(getSelectionOffsets(root)).toEqual({
            start: 22,
            end: text.length,
        });

        const both = document.createRange();
        both.setStart(root.previousSibling!, 2);
        both.setEnd(root.nextSibling!, 2);
        setSelection(both);
        expect(getSelectionOffsets(root)).toEqual({
            start: 0,
            end: text.length,
        });
    });

    it('returns null for collapsed or foreign selections', () => {
        const root = mount(text, hl, { before: 'BEFORE ', after: ' AFTER' });
        const other = document.createElement('p');
        other.textContent = 'somewhere else';
        document.body.appendChild(other);

        // No selection at all.
        window.getSelection()!.removeAllRanges();
        expect(getSelectionOffsets(root)).toBeNull();

        // Collapsed inside the root.
        const collapsed = createRangeFromOffsets(root, 8, 8)!;
        expect(collapsed.collapsed).toBe(true);
        setSelection(collapsed);
        expect(getSelectionOffsets(root)).toBeNull();

        // Entirely inside another element.
        const foreign = document.createRange();
        foreign.selectNodeContents(other.firstChild!);
        setSelection(foreign);
        expect(getSelectionOffsets(root)).toBeNull();

        // Entirely in the sibling text before the root, ending exactly at the root's edge.
        const touching = document.createRange();
        touching.setStart(root.previousSibling!, 0);
        touching.setEnd(
            document.body,
            [...document.body.childNodes].indexOf(root),
        );
        setSelection(touching);
        expect(getSelectionOffsets(root)).toBeNull();

        // A second root does not see the first root's selection.
        const root2 = mount('another root', []);
        select(root, 2, 6);
        expect(getSelectionOffsets(root2)).toBeNull();
        expect(getSelectionOffsets(root)).toEqual({ start: 2, end: 6 });
    });

    it('ignores text inside data-om-skip decorations', () => {
        const root = mount(text, hl, { decorate: '[note]' });
        expect(root.querySelector('[data-om-skip]')).not.toBeNull();
        select(root, 8, 18);
        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(getTextLength(root)).toBe(text.length);

        // A boundary placed inside the decoration resolves to the position where it sits (15).
        const deco = root.querySelector('[data-om-skip]')!;
        const r = document.createRange();
        r.setStart(deco.firstChild!, 2);
        r.setEnd(
            createRangeFromOffsets(root, 18, 18)!.startContainer,
            createRangeFromOffsets(root, 18, 18)!.startOffset,
        );
        setSelection(r);
        expect(getSelectionOffsets(root)).toEqual({ start: 15, end: 18 });
    });

    it('offsets match string indices with CRLF, tabs and leading spaces', () => {
        const t2 = '\n  first\r\n\tsecond  ';
        const root = mount(t2, [{ id: 'x', start: 3, end: 12 }]);
        select(root, 3, 12);
        expect(getSelectionOffsets(root)).toEqual({ start: 3, end: 12 });
        expect(window.getSelection()!.toString()).toBe(t2.slice(3, 12));

        select(root, 0, t2.length);
        expect(getSelectionOffsets(root)).toEqual({ start: 0, end: t2.length });
    });
});

describe('createRangeFromOffsets', () => {
    it('round-trips every start/end pair through createRangeFromOffsets', () => {
        for (const options of [
            {},
            { decorate: '[note]' },
            { strategy: 'depth' as const },
        ]) {
            const root = mount(text, hl, options);
            for (let s = 0; s < text.length; s++) {
                for (let e = s + 1; e <= text.length; e++) {
                    if (isLowSurrogateAt(text, s) || isLowSurrogateAt(text, e))
                        continue;
                    const r = createRangeFromOffsets(root, s, e)!;
                    expect(r.toString().replace('[note]', '')).toBe(
                        text.slice(s, e),
                    );
                    setSelection(r);
                    expect(getSelectionOffsets(root)).toEqual({
                        start: s,
                        end: e,
                    });
                }
            }
            root.remove();
        }
    });

    it('never includes decoration text in a range that does not cross it', () => {
        const root = mount(text, hl, { decorate: '[note]' });
        expect(createRangeFromOffsets(root, 6, 15)!.toString()).toBe(
            'wonderful',
        );
        expect(createRangeFromOffsets(root, 15, 21)!.toString()).toBe(' world');
    });

    it('clamps out-of-bounds offsets and rejects inverted ranges', () => {
        const root = mount(text, hl);
        expect(createRangeFromOffsets(root, -5, 5)!.toString()).toBe(
            text.slice(0, 5),
        );
        expect(createRangeFromOffsets(root, 30, 999)!.toString()).toBe(
            text.slice(30),
        );
        expect(createRangeFromOffsets(root, 5, 2)).toBeNull();
        expect(createRangeFromOffsets(root, Number.NaN, 2)).toBeNull();
    });

    it('handles an empty root', () => {
        const root = mount('', []);
        expect(getTextLength(root)).toBe(0);
        const r = createRangeFromOffsets(root, 0, 0)!;
        expect(r.collapsed).toBe(true);
        expect(root.contains(r.startContainer)).toBe(true);
    });
});

describe('getOffsetFromPoint', () => {
    it('getOffsetFromPoint returns the index under a character', () => {
        const root = mount(text, hl);
        const r = createRangeFromOffsets(root, 10, 11)!.getBoundingClientRect();
        expect(getOffsetFromPoint(root, r.left + 1, r.top + r.height / 2)).toBe(
            10,
        );
        // The right half of the glyph is still character 10, not the caret after it.
        expect(
            getOffsetFromPoint(root, r.right - 1, r.top + r.height / 2),
        ).toBe(10);
    });

    it('resolves the character under the point across segment boundaries', () => {
        const root = mount(text, hl);
        // 14 is the last char of segment [6,15); 15 the first of [15,21); 5 the last of [0,6).
        for (const i of [0, 5, 6, 14, 15, 20, 21]) {
            const { x, y, rect } = centerOf(root, i, i + 1);
            expect(getOffsetFromPoint(root, x, y)).toBe(i);
            expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(i);
        }
        // The emoji is a surrogate pair: both halves of the glyph map to its first code unit.
        const emoji = text.indexOf('😀');
        const { y, rect } = centerOf(root, emoji, emoji + 2);
        expect(getOffsetFromPoint(root, rect.left + 1, y)).toBe(emoji);
        expect(getOffsetFromPoint(root, rect.right - 1, y)).toBe(emoji);
    });

    it('falls back to caretRangeFromPoint', () => {
        const root = mount(text, hl);
        const { x, y } = centerOf(root, 10, 11);
        Object.defineProperty(document, 'caretPositionFromPoint', {
            value: undefined,
            configurable: true,
        });
        try {
            expect(getOffsetFromPoint(root, x, y)).toBe(10);
        } finally {
            delete (document as { caretPositionFromPoint?: unknown })
                .caretPositionFromPoint;
        }
        expect(typeof document.caretPositionFromPoint).toBe('function');
    });

    it('returns null outside the root and on skip decorations', () => {
        const root = mount(text, hl, { decorate: '[note]' });
        const other = document.createElement('p');
        other.textContent = 'somewhere else';
        document.body.appendChild(other);
        const o = other.getBoundingClientRect();
        expect(
            getOffsetFromPoint(root, o.left + 2, o.top + o.height / 2),
        ).toBeNull();

        const d = root.querySelector('[data-om-skip]')!.getBoundingClientRect();
        for (const x of [d.left + 1, d.left + d.width / 2, d.right - 1]) {
            expect(
                getOffsetFromPoint(root, x, d.top + d.height / 2),
            ).toBeNull();
        }
    });
});

describe('getTextLength', () => {
    it('equals the source text length', () => {
        expect(getTextLength(mount(text, hl))).toBe(text.length);
        expect(getTextLength(mount(text, hl, { strategy: 'depth' }))).toBe(
            text.length,
        );
        expect(getTextLength(mount('plain', []))).toBe(5);
    });
});
