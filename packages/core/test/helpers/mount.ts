// Shared browser-test helpers. Intentionally does NOT import the stylesheet:
// tests that need it import '../src/styles.css' themselves.
import { computeSegments, rootAttributes, segmentElements } from '../../src';
import type { Highlight, RenderOptions } from '../../src';
import { createRangeFromOffsets } from '../../src/dom';

export interface MountOptions extends RenderOptions {
    /** Text node inserted as the root's previous sibling (outside the root). */
    before?: string;
    /** Text node inserted as the root's next sibling (outside the root). */
    after?: string;
    /** Appends `<span data-om-skip aria-hidden="true">{decorate}</span>` inside the first highlight element with `data-id="b"`. */
    decorate?: string;
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
        const target = root.querySelector('[data-id="b"]');
        if (!target)
            throw new Error('mount: decorate needs a highlight with id "b"');
        const deco = document.createElement('span');
        deco.setAttribute('data-om-skip', '');
        deco.setAttribute('aria-hidden', 'true');
        deco.textContent = decorate;
        target.appendChild(deco);
    }
    if (before !== undefined) document.body.append(before);
    document.body.appendChild(root);
    if (after !== undefined) document.body.append(after);
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

/** True when index `i` falls between the two halves of a surrogate pair. */
export function isLowSurrogateAt(text: string, i: number): boolean {
    if (i <= 0 || i >= text.length) return false;
    const lo = text.charCodeAt(i);
    const hi = text.charCodeAt(i - 1);
    return lo >= 0xdc00 && lo <= 0xdfff && hi >= 0xd800 && hi <= 0xdbff;
}
