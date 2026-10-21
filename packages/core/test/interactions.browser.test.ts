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
});

describe('attachInteractions: click and dblclick', () => {
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
});

describe('attachInteractions: hover', () => {
    it('hover emits enter/leave per segment and nothing between nested marks', async () => {
        const { root, onHover } = setup();
        const seen = () =>
            onHover.mock.calls.map(([d]) => `${d.type}:${d.segment.start}`);

        // Park the mouse on plain text first: the pointer left over from an
        // earlier test may sit where this root's highlights now render.
        await userEvent.hover(segEl(root, 21));
        await tick();
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
