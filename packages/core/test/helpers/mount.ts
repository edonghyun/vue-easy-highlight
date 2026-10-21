// Shared browser-test helpers. Intentionally does NOT import the stylesheet:
// tests that need it import '../src/styles.css' themselves.
import { setSelection } from '@overlapmark/adapter-contract';
import { onTestFinished } from 'vitest';
import {
    computeSegments,
    decorationTarget,
    rootAttributes,
    segmentElements,
} from '../../src';
import type { ElementSpec, Highlight, RenderOptions, Segment } from '../../src';
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
export function givenInDocument<T extends Node>(node: T): T {
    document.body.appendChild(node);
    onTestFinished(() => {
        node.parentNode?.removeChild(node);
        window.getSelection()?.removeAllRanges();
    });
    return node;
}

export interface RenderIntoOptions extends RenderOptions {
    /** Decoration text for each highlighted segment, as in the adapter contract. */
    decoration?: (segment: Segment) => string;
}

/**
 * Renders `text` with `highlights` into `root` from the core render model,
 * replacing its children and setting the root class and attributes. With
 * `decoration`, each highlighted segment's innermost element ends with
 * `<span data-om-skip aria-hidden="true">{decoration}</span>`.
 */
export function renderInto(
    root: HTMLElement,
    text: string,
    highlights: readonly Highlight[],
    options: RenderIntoOptions = {},
): void {
    const r = rootAttributes(options);
    root.classList.add(r.className);
    for (const [k, v] of Object.entries(r.attrs)) root.setAttribute(k, v);
    const frag = document.createDocumentFragment();
    for (const seg of computeSegments(text, [...highlights])) {
        const specs = segmentElements(seg, options);
        const elements = specs.map(elementOf);
        let parent: Node = frag;
        for (const el of elements) {
            parent.appendChild(el);
            parent = el;
        }
        parent.appendChild(document.createTextNode(seg.text));
        const target = decorationTarget(seg, specs);
        if (target && options.decoration) {
            const deco = elementOf(target.container);
            deco.textContent = options.decoration(seg);
            elements[target.index].appendChild(deco);
        }
    }
    root.replaceChildren(frag);
}

/** The element `spec` describes, without children. */
function elementOf(spec: ElementSpec): HTMLElement {
    const el = document.createElement(spec.tag);
    if (spec.className) el.className = spec.className;
    for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
    for (const [k, v] of Object.entries(spec.style)) el.style.setProperty(k, v);
    return el;
}

function decorationOf(text: string): HTMLElement {
    const deco = document.createElement('span');
    deco.setAttribute('data-om-skip', '');
    deco.setAttribute('aria-hidden', 'true');
    deco.textContent = text;
    return deco;
}

export function givenRenderedRoot(
    text: string,
    highlights: Highlight[],
    options: MountOptions = {},
): HTMLElement {
    const { before, after, decorate, ...renderOptions } = options;
    const root = document.createElement('div');
    renderInto(root, text, highlights, renderOptions);
    if (decorate !== undefined) {
        const target = root.querySelector(`[data-id="${decorate.id}"]`);
        if (!target)
            throw new Error(
                `givenRenderedRoot: decorate needs a highlight with id "${decorate.id}"`,
            );
        target.appendChild(decorationOf(decorate.text));
    }
    if (before !== undefined) givenInDocument(document.createTextNode(before));
    givenInDocument(root);
    if (after !== undefined) givenInDocument(document.createTextNode(after));
    return root;
}

export function select(root: Element, start: number, end: number): void {
    const range = createRangeFromOffsets(root, start, end);
    if (!range) throw new Error(`select: no range for ${start}..${end}`);
    setSelection(range);
}

/** Selects from the start of the text node before `root` (see `givenRenderedRoot({ before })`) to `offset` inside root. */
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
