// Shared browser-test helpers. Intentionally does NOT import the stylesheet:
// tests that need it import '../src/styles.css' themselves.
import { setSelection } from '@overlapmark/adapter-contract';
import { onTestFinished } from 'vitest';
import { computeSegments } from '../../src';
import type { Highlight, RenderOptions, Segment } from '../../src';
import {
    decorationTarget,
    rootAttributes,
    segmentElements,
} from '../../src/adapter';
import type { ElementSpec } from '../../src/adapter';
import { createRangeFromOffsets } from '../../src/dom';

export interface MountOptions extends RenderOptions {
    /** Text node inserted as the root's previous sibling (outside the root). */
    before?: string;
    /** Text node inserted as the root's next sibling (outside the root). */
    after?: string;
    /** Appends `<span data-om-skip aria-hidden="true">{text}</span>` inside the first element with `data-om-id={id}`. */
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

/** An open shadow root on an element appended to the body (see `givenInDocument`). */
export function givenShadowRoot(): ShadowRoot {
    return givenInDocument(document.createElement('div')).attachShadow({
        mode: 'open',
    });
}

/**
 * The document of an iframe appended to the body (see `givenInDocument`):
 * another document and another realm, whose `Node`, `Element` and `window`
 * are not this page's.
 */
export function givenFrameDocument(): Document {
    const frame = givenInDocument(document.createElement('iframe'));
    return frame.contentDocument!;
}

export interface RenderIntoOptions extends RenderOptions {
    /** Decoration text for each highlighted segment, as in the adapter contract. */
    decoration?: (segment: Segment) => string;
}

/**
 * Renders `text` with `highlights` into `root` from the core render model,
 * replacing its children and setting the root class, attributes and style. With
 * `decoration`, each highlighted segment's innermost element ends with
 * `<span data-om-skip aria-hidden="true">{decoration}</span>`, unless the
 * decoration is `''`. The elements are created in `root`'s own document.
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
    // The root's inline style is core's alone: drop what an earlier render set.
    root.removeAttribute('style');
    for (const [k, v] of Object.entries(r.style)) root.style.setProperty(k, v);
    const doc = root.ownerDocument;
    const frag = doc.createDocumentFragment();
    for (const seg of computeSegments(text, [...highlights])) {
        const specs = segmentElements(seg, options);
        const elements = specs.map((spec) => elementOf(doc, spec));
        let parent: Node = frag;
        for (const el of elements) {
            parent.appendChild(el);
            parent = el;
        }
        parent.appendChild(doc.createTextNode(seg.text));
        const target = decorationTarget(seg, specs);
        const decoration =
            target && options.decoration ? options.decoration(seg) : '';
        // '' is no decoration: the segment gets no container.
        if (target && decoration !== '') {
            const deco = elementOf(doc, target.container);
            deco.textContent = decoration;
            elements[target.index]!.appendChild(deco);
        }
    }
    root.replaceChildren(frag);
}

/** The element `spec` describes, created in `doc`, without children. */
function elementOf(doc: Document, spec: ElementSpec): HTMLElement {
    const el = doc.createElement(spec.tag);
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

/**
 * A root rendering `text` with `highlights` (see `renderInto`), created in
 * `parent`'s document and appended to `parent`: a shadow root, or an element
 * of another document. It goes when `parent` goes.
 */
export function givenRenderedRootIn(
    parent: Node,
    text: string,
    highlights: readonly Highlight[],
    options: RenderIntoOptions = {},
): HTMLElement {
    const root = parent.ownerDocument!.createElement('div');
    renderInto(root, text, highlights, options);
    parent.appendChild(root);
    return root;
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
        const target = root.querySelector(`[data-om-id="${decorate.id}"]`);
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

/** Selects [start, end) of `root` in the selection of `root`'s own window. */
export function select(root: Element, start: number, end: number): void {
    const range = createRangeFromOffsets(root, start, end);
    if (!range) throw new Error(`select: no range for ${start}..${end}`);
    const selection = root.ownerDocument.defaultView!.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
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
