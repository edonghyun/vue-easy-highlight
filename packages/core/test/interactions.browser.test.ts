import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../src/styles.css';
import { computeSegments } from '../src';
import type { Highlight, HoverDetail, PointDetail, SelectDetail } from '../src';
import { attachInteractions, createRangeFromOffsets } from '../src/dom';
import type { InteractionOptions } from '../src/dom';
import { mount, select } from './helpers/mount';

const text = 'Hello wonderful world 😀 하이라이트';
const a: Highlight = { id: 'a', start: 0, end: 15 };
const b: Highlight = { id: 'b', start: 6, end: 21 };
const hl = [a, b];

const detachers: (() => void)[] = [];

afterEach(() => {
    while (detachers.length) detachers.pop()!();
    window.getSelection()?.removeAllRanges();
    document.body.textContent = '';
});

interface Setup {
    root: HTMLElement;
    onSelect: ReturnType<typeof vi.fn<(d: SelectDetail) => void>>;
    onClick: ReturnType<typeof vi.fn<(d: PointDetail) => void>>;
    onDblclick: ReturnType<typeof vi.fn<(d: PointDetail) => void>>;
    onHover: ReturnType<typeof vi.fn<(d: HoverDetail) => void>>;
    detach: () => void;
}

function setup(
    options: Partial<InteractionOptions> = {},
    src: string = text,
    highlights: Highlight[] = hl,
): Setup {
    const root = mount(src, highlights);
    const segments = computeSegments(src, highlights);
    const onSelect = vi.fn<(d: SelectDetail) => void>();
    const onClick = vi.fn<(d: PointDetail) => void>();
    const onDblclick = vi.fn<(d: PointDetail) => void>();
    const onHover = vi.fn<(d: HoverDetail) => void>();
    const detach = attachInteractions(root, {
        getText: () => src,
        getSegments: () => segments,
        onSelect,
        onClick,
        onDblclick,
        onHover,
        ...options,
        // Forwarded live, so a test can change them after attaching.
        get minSelectionLength() {
            return options.minSelectionLength;
        },
        get touchSelectionDelay() {
            return options.touchSelectionDelay;
        },
    });
    detachers.push(detach);
    return { root, onSelect, onClick, onDblclick, onHover, detach };
}

/** Lets the asynchronous `selectionchange` event (and friends) be delivered. */
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function pointer(
    type: string,
    target: EventTarget,
    init: PointerEventInit = {},
): void {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerType: 'mouse',
            ...init,
        }),
    );
}

/** Ends a (simulated) drag: pointerup on the document, then lets confirmation run. */
async function release(): Promise<void> {
    pointer('pointerup', document);
    await tick();
}

/** Position of the center of character `i`, relative to the segment element containing it. */
function charPosition(
    root: HTMLElement,
    i: number,
): { el: Element; position: { x: number; y: number } } {
    const range = createRangeFromOffsets(root, i, i + 1)!;
    const rect = range.getBoundingClientRect();
    const node = range.startContainer;
    const el = (node instanceof Element ? node : node.parentElement!).closest(
        '[data-om-start]',
    )!;
    const box = el.getBoundingClientRect();
    return {
        el,
        position: {
            x: rect.left + rect.width / 2 - box.left,
            y: rect.top + rect.height / 2 - box.top,
        },
    };
}

function segEl(root: HTMLElement, start: number): HTMLElement {
    return root.querySelector<HTMLElement>(`[data-om-start="${start}"]`)!;
}

describe('attachInteractions: select', () => {
    it('emits select once with offsets, text, rect and overlapping highlights after a drag', async () => {
        const { root, onSelect } = setup();
        select(root, 8, 18);
        await tick();
        await release();
        await tick();
        expect(onSelect).toHaveBeenCalledTimes(1);
        const d = onSelect.mock.calls[0][0];
        expect(d).toMatchObject({
            start: 8,
            end: 18,
            text: text.slice(8, 18),
        });
        expect(d.highlights).toEqual([a, b]);
        expect(d.highlights[0]).toBe(a);
        expect(d.rect).toBeInstanceOf(DOMRect);
        expect(d.rect.width).toBeGreaterThan(0);
    });

    it('emits select after a real mouse drag', async () => {
        const { root, onSelect } = setup();
        const from = charPosition(root, 1);
        const to = charPosition(root, 18);
        await userEvent.dragAndDrop(
            page.elementLocator(from.el),
            page.elementLocator(to.el),
            {
                sourcePosition: {
                    x: from.position.x - 3,
                    y: from.position.y,
                },
                targetPosition: to.position,
            },
        );
        await expect.poll(() => onSelect.mock.calls.length).toBe(1);
        const d = onSelect.mock.calls[0][0];
        expect(d.text).toBe(text.slice(d.start, d.end));
        expect(d.start).toBe(1);
        expect(d.end).toBeGreaterThanOrEqual(18);
    });

    it('does not re-emit the same selection on pointerup followed by keyup', async () => {
        const { root, onSelect } = setup();
        select(root, 8, 18);
        await tick();
        await release();
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
        await tick();
        expect(onSelect).toHaveBeenCalledTimes(1);

        // Re-selecting the same range without a selection change in between is not re-emitted...
        select(root, 8, 18);
        await tick();
        await release();
        expect(onSelect).toHaveBeenCalledTimes(1);

        // ...but clearing the selection resets the "previous" value.
        window.getSelection()!.removeAllRanges();
        await tick();
        select(root, 8, 18);
        await tick();
        await release();
        expect(onSelect).toHaveBeenCalledTimes(2);

        // A different range is emitted.
        select(root, 2, 5);
        await tick();
        await release();
        expect(onSelect).toHaveBeenCalledTimes(3);
        expect(onSelect.mock.calls[2][0]).toMatchObject({ start: 2, end: 5 });
    });

    it('respects minSelectionLength', async () => {
        const { root, onSelect } = setup({ minSelectionLength: 3 });
        select(root, 2, 4);
        await tick();
        await release();
        await tick();
        expect(onSelect).not.toHaveBeenCalled();

        select(root, 2, 5);
        await tick();
        await release();
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toMatchObject({
            start: 2,
            end: 5,
            text: text.slice(2, 5),
        });
    });

    it('reads minSelectionLength and touchSelectionDelay live from options', async () => {
        const options: Partial<InteractionOptions> = { minSelectionLength: 5 };
        const { root, onSelect } = setup(options);
        select(root, 2, 4);
        await tick();
        await release();
        expect(onSelect).not.toHaveBeenCalled();

        options.minSelectionLength = 1;
        select(root, 2, 5);
        await tick();
        await release();
        expect(onSelect).toHaveBeenCalledTimes(1);

        options.touchSelectionDelay = 40;
        pointer('pointerdown', root, { pointerType: 'touch' });
        select(root, 8, 18);
        await tick(10);
        expect(onSelect).toHaveBeenCalledTimes(1);
        await tick(80);
        expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('emits select from a keyboard selection (keyup)', async () => {
        const { root, onSelect } = setup({ minSelectionLength: 2 });
        // Headless Chromium only extends an existing (non-collapsed) selection
        // with Shift+Arrow in non-editable content, so start from one character.
        select(root, 0, 1);
        await tick();
        expect(onSelect).not.toHaveBeenCalled();
        await userEvent.keyboard(
            '{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}',
        );
        await expect.poll(() => onSelect.mock.calls.length).toBe(1);
        await tick(50);
        // Arrow keyups while Shift is still held do not confirm; releasing Shift does, once.
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toMatchObject({
            start: 0,
            end: 5,
            text: 'Hello',
            highlights: [a],
        });
    });

    it('does not confirm on keyup while a modifier is still held', async () => {
        const { root, onSelect } = setup();
        select(root, 2, 6);
        await tick();
        for (const mod of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey']) {
            document.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'ArrowRight', [mod]: true }),
            );
        }
        await tick();
        expect(onSelect).not.toHaveBeenCalled();
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
        await expect.poll(() => onSelect.mock.calls.length).toBe(1);
        expect(onSelect.mock.calls[0][0]).toMatchObject({ start: 2, end: 6 });
    });

    it('emits select for touch after touchSelectionDelay without pointerup', async () => {
        const { root, onSelect } = setup({ touchSelectionDelay: 50 });
        pointer('pointerdown', root, { pointerType: 'touch' });
        select(root, 8, 18);
        await tick(10);
        expect(onSelect).not.toHaveBeenCalled();
        await tick(120);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toMatchObject({ start: 8, end: 18 });

        // A further handle adjustment restarts the wait and emits the new range.
        select(root, 8, 20);
        await tick(120);
        expect(onSelect).toHaveBeenCalledTimes(2);
        expect(onSelect.mock.calls[1][0]).toMatchObject({ start: 8, end: 20 });
    });

    it('ignores selections in another root', async () => {
        const A = setup();
        document.body.append('Elsewhere on the page');
        const B = setup();
        const outside = document.body.childNodes[1] as Text;
        expect(outside.textContent).toBe('Elsewhere on the page');

        select(B.root, 2, 9);
        await tick();
        await release();
        await tick();
        expect(B.onSelect).toHaveBeenCalledTimes(1);
        expect(A.onSelect).not.toHaveBeenCalled();

        const r = document.createRange();
        r.setStart(outside, 0);
        r.setEnd(outside, 9);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(r);
        await tick();
        await release();
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
        await tick();
        expect(A.onSelect).not.toHaveBeenCalled();
        expect(B.onSelect).toHaveBeenCalledTimes(1);

        select(A.root, 1, 3);
        await tick();
        await release();
        expect(A.onSelect).toHaveBeenCalledTimes(1);
        expect(B.onSelect).toHaveBeenCalledTimes(1);
    });
});

describe('attachInteractions: click and dblclick', () => {
    it('click reports offset and covering highlights in overlap order', async () => {
        const { root, onClick } = setup();
        const { el, position } = charPosition(root, 10);
        await userEvent.click(el, { position });
        expect(onClick).toHaveBeenCalledTimes(1);
        const d = onClick.mock.calls[0][0];
        expect(d.offset).toBe(10);
        expect(d.highlights).toEqual([a, b]);
        expect(d.segment).toMatchObject({ start: 6, end: 15 });
        expect(d.event).toBeInstanceOf(MouseEvent);
        expect(d.event.type).toBe('click');
    });

    it('click on plain text reports empty highlights', async () => {
        const { root, onClick } = setup();
        const { el, position } = charPosition(root, 26);
        await userEvent.click(el, { position });
        expect(onClick).toHaveBeenCalledTimes(1);
        const d = onClick.mock.calls[0][0];
        expect(d.offset).toBe(26);
        expect(d.highlights).toEqual([]);
        expect(d.segment.depth).toBe(0);
    });

    it('clamps the offset to the segment and falls back to segment.start', () => {
        const { root, onClick } = setup();
        const el = segEl(root, 6);
        // Point far outside the root: getOffsetFromPoint fails → segment.start.
        el.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                clientX: -100,
                clientY: -100,
            }),
        );
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][0].offset).toBe(6);

        // Point on a character of another segment: clamped into [6, 14].
        const r = createRangeFromOffsets(root, 2, 3)!.getBoundingClientRect();
        el.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                clientX: r.left + r.width / 2,
                clientY: r.top + r.height / 2,
            }),
        );
        expect(onClick.mock.calls[1][0].offset).toBe(6);
    });

    it('does not emit click right after a drag selection', async () => {
        const { root, onClick, onSelect } = setup();
        const el = segEl(root, 6);
        select(root, 8, 18);
        await tick();
        // The click that ends a drag fires while the selection is still in place.
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onClick).not.toHaveBeenCalled();

        // A real drag ending inside a highlight.
        window.getSelection()!.removeAllRanges();
        const from = charPosition(root, 7);
        const to = charPosition(root, 12);
        await userEvent.dragAndDrop(
            page.elementLocator(from.el),
            page.elementLocator(to.el),
            { sourcePosition: from.position, targetPosition: to.position },
        );
        await tick();
        expect(window.getSelection()!.isCollapsed).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
        expect(onSelect).toHaveBeenCalled();
    });

    it('dblclick emits with the browser word selection in place', async () => {
        const { root, onDblclick } = setup();
        const { el, position } = charPosition(root, 10);
        await userEvent.dblClick(el, { position });
        expect(onDblclick).toHaveBeenCalledTimes(1);
        expect(window.getSelection()!.toString()).toBe('wonderful');
        const d = onDblclick.mock.calls[0][0];
        expect(d.offset).toBe(10);
        expect(d.highlights).toEqual([a, b]);
        expect(d.event.type).toBe('dblclick');
    });

    it('Enter and Space on a focused highlight emit click with segment.start', async () => {
        const { root, onClick } = setup();
        const el = segEl(root, 6);
        expect(el.getAttribute('tabindex')).toBe('0');
        el.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(onClick).toHaveBeenCalledTimes(2);
        for (const [d] of onClick.mock.calls) {
            expect(d.offset).toBe(6);
            expect(d.segment).toMatchObject({ start: 6, end: 15 });
            expect(d.highlights).toEqual([a, b]);
            expect(d.event).toBeInstanceOf(KeyboardEvent);
        }
        expect(
            onClick.mock.calls.map(([d]) => (d.event as KeyboardEvent).key),
        ).toEqual(['Enter', ' ']);

        const ev = new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true,
        });
        el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);

        // Other keys and non-focusable plain segments are ignored.
        el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
        );
        segEl(root, 21).dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        expect(onClick).toHaveBeenCalledTimes(3);
    });
});

describe('attachInteractions: hover', () => {
    it('hover emits enter/leave per segment and nothing between nested marks', async () => {
        const { root, onHover } = setup();
        const seen = () =>
            onHover.mock.calls.map(([d]) => `${d.type}:${d.segment.start}`);

        // Real mouse movement: plain text → [6,15) → [15,21) → plain text.
        // Park the mouse on plain text first: the pointer left over from an
        // earlier test may sit where this root's highlights now render.
        await userEvent.hover(segEl(root, 21));
        await tick();
        onHover.mockClear();
        await userEvent.hover(segEl(root, 6));
        await userEvent.hover(segEl(root, 15));
        await userEvent.hover(segEl(root, 21));
        expect(seen()).toEqual(['enter:6', 'leave:6', 'enter:15', 'leave:15']);
        const enter = onHover.mock.calls[0][0];
        expect(enter.highlights).toEqual([a, b]);
        expect(enter.segment).toMatchObject({ start: 6, end: 15, depth: 2 });
        expect(enter.event).toBeInstanceOf(PointerEvent);

        // Moving between the nested marks of one segment emits nothing.
        onHover.mockClear();
        const outer = segEl(root, 6);
        const inner = outer.querySelector('mark')!;
        expect(inner.hasAttribute('data-om-start')).toBe(false);
        pointer('pointerover', outer, { relatedTarget: segEl(root, 0) });
        pointer('pointerout', outer, { relatedTarget: inner });
        pointer('pointerover', inner, { relatedTarget: outer });
        pointer('pointerout', inner, { relatedTarget: outer });
        pointer('pointerover', outer, { relatedTarget: inner });
        expect(seen()).toEqual(['enter:6']);

        // Non-mouse pointers are ignored.
        pointer('pointerout', outer, {
            relatedTarget: segEl(root, 15),
            pointerType: 'touch',
        });
        pointer('pointerover', segEl(root, 15), {
            relatedTarget: outer,
            pointerType: 'pen',
        });
        expect(seen()).toEqual(['enter:6']);

        // Leaving the root.
        pointer('pointerout', inner, { relatedTarget: document.body });
        expect(seen()).toEqual(['enter:6', 'leave:6']);
    });
});

describe('attachInteractions: detach', () => {
    it('detach removes all listeners', async () => {
        const s = setup({ touchSelectionDelay: 30 });
        // Arm a pending touch-confirmation timer, then detach before it fires.
        pointer('pointerdown', s.root, { pointerType: 'touch' });
        select(s.root, 1, 4);
        await tick(5);
        s.detach();
        await tick(80);

        pointer('pointerdown', s.root, { pointerType: 'mouse' });
        select(s.root, 8, 18);
        await tick();
        await release();
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
        window.getSelection()!.removeAllRanges();
        await tick();

        const { el, position } = charPosition(s.root, 10);
        await userEvent.click(el, { position });
        await userEvent.dblClick(el, { position });
        window.getSelection()!.removeAllRanges();
        segEl(s.root, 6).focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.hover(segEl(s.root, 15));
        await userEvent.hover(segEl(s.root, 21));

        expect(s.onSelect).not.toHaveBeenCalled();
        expect(s.onClick).not.toHaveBeenCalled();
        expect(s.onDblclick).not.toHaveBeenCalled();
        expect(s.onHover).not.toHaveBeenCalled();
    });
});
