// Shared browser-test helpers. Intentionally does NOT import the stylesheet:
// tests that need it import '../src/styles.css' themselves.
import { onTestFinished } from 'vitest';
import { computeSegments, rootAttributes, segmentElements } from '../../src';
import type { Highlight, RenderOptions } from '../../src';
import { createRangeFromOffsets } from '../../src/dom';

export interface MountOptions extends RenderOptions {
    /** Text node inserted as the root's previous sibling (outside the root). */
    before?: string;
    /** Text node inserted as the root's next sibling (outside the root). */
    after?: string;
    /** Appends `<span data-om-skip aria-hidden="true">{text}</span>` inside the first element with `data-id={id}`. */
    decorate?: { id: string; text: string };
}

/**
 * Appends `node` to the body and removes it when the current test finishes,
 * together with any selection the test left behind.
 */
export function attach<T extends Node>(node: T): T {
    document.body.appendChild(node);
    onTestFinished(() => {
        node.parentNode?.removeChild(node);
        window.getSelection()?.removeAllRanges();
    });
    return node;
}

export function mount(
    text: string,
    highlights: Highlight[],
    options: MountOptions = {},
): HTMLElement {
    const { before, after, decorate, ...renderOptions } = options;
    const root = document.createElement('div');
    const r = rootAttributes(renderOptions);
    root.className = r.className;
    for (const [k, v] of Object.entries(r.attrs)) root.setAttribute(k, v);
    for (const seg of computeSegments(text, highlights)) {
        let parent: HTMLElement = root;
        for (const spec of segmentElements(seg, renderOptions)) {
            const el = document.createElement(spec.tag);
            el.className = spec.className;
            for (const [k, v] of Object.entries(spec.attrs))
                el.setAttribute(k, v);
            for (const [k, v] of Object.entries(spec.style))
                el.style.setProperty(k, v);
            parent.appendChild(el);
            parent = el;
        }
        parent.append(seg.text);
    }
    if (decorate !== undefined) {
        const target = root.querySelector(`[data-id="${decorate.id}"]`);
        if (!target)
            throw new Error(
                `mount: decorate needs a highlight with id "${decorate.id}"`,
            );
        const deco = document.createElement('span');
        deco.setAttribute('data-om-skip', '');
        deco.setAttribute('aria-hidden', 'true');
        deco.textContent = decorate.text;
        target.appendChild(deco);
    }
    if (before !== undefined) attach(document.createTextNode(before));
    attach(root);
    if (after !== undefined) attach(document.createTextNode(after));
    return root;
}

export function setSelection(range: Range): void {
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
}

export function select(root: Element, start: number, end: number): void {
    const range = createRangeFromOffsets(root, start, end);
    if (!range) throw new Error(`select: no range for ${start}..${end}`);
    setSelection(range);
}

/** Selects from the start of the text node before `root` (see `mount({ before })`) to `offset` inside root. */
export function selectFromOutsideTo(root: Element, offset: number): void {
    const outside = root.previousSibling;
    if (!outside)
        throw new Error('selectFromOutsideTo: root has no previous sibling');
    const inner = createRangeFromOffsets(root, 0, offset);
    if (!inner)
        throw new Error(`selectFromOutsideTo: no range for 0..${offset}`);
    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(inner.endContainer, inner.endOffset);
    setSelection(range);
}
