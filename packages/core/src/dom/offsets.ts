/**
 * DOM <-> original-text position helpers.
 *
 * Positions are JS string indices (UTF-16 code units) into the original text.
 * The DOM contract: every segment's outermost element carries `data-om-start`
 * (its start index); text inside `[data-om-skip]` is decoration and is never counted.
 * A boundary's position is: the nearest `[data-om-start]` ancestor's value
 * + the lengths of counted text nodes before the boundary inside that element
 * + the offset inside the boundary's text node.
 */

import { isHighSurrogate, isLowSurrogate } from '../unicode';

export interface TextRange {
    start: number;
    end: number;
}

const START_ATTR = 'data-om-start';
const SKIP_ATTR = 'data-om-skip';

interface SegmentInfo {
    el: Element;
    start: number;
}

/** True when `node` (or an ancestor up to, excluding, `root`) is a skip decoration. */
function isSkipped(root: Element, node: Node): boolean {
    let el: Element | null =
        node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
    while (el && el !== root) {
        if (el.hasAttribute(SKIP_ATTR)) return true;
        el = el.parentElement;
    }
    return false;
}

/** Counted (non-skip) text nodes under `container`, in document order. */
function textNodes(container: Node): Text[] {
    const out: Text[] = [];
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    return (node as Element).hasAttribute(SKIP_ATTR)
                        ? NodeFilter.FILTER_REJECT
                        : NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        },
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode())
        out.push(n as Text);
    return out;
}

function textLength(container: Node): number {
    let len = 0;
    for (const t of textNodes(container)) len += t.data.length;
    return len;
}

function parseStart(el: Element): number | null {
    const v = Number(el.getAttribute(START_ATTR));
    return Number.isFinite(v) ? v : null;
}

/** Outermost `[data-om-start]` elements of `root` (not inside a skip decoration), in document order. */
function segments(root: Element): SegmentInfo[] {
    const out: SegmentInfo[] = [];
    for (const el of root.querySelectorAll(`[${START_ATTR}]`)) {
        if (isSkipped(root, el)) continue;
        const parentSeg = el.parentElement?.closest(`[${START_ATTR}]`);
        if (parentSeg && parentSeg !== root && root.contains(parentSeg))
            continue;
        const start = parseStart(el);
        if (start !== null) out.push({ el, start });
    }
    return out;
}

/** Nearest `[data-om-start]` ancestor-or-self of `node` that lies inside `root`. */
function segmentOf(root: Element, node: Node): Element | null {
    const el =
        node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
    const seg = el?.closest(`[${START_ATTR}]`) ?? null;
    return seg && seg !== root && root.contains(seg) ? seg : null;
}

/**
 * Original-text position of the boundary point (`node`, `offset`), which must lie inside `root`.
 * Element containers are handled through boundary-point comparison, so
 * (`el`, childIndex) resolves to the text position of that child edge.
 */
function positionOf(root: Element, node: Node, offset: number): number {
    const seg = segmentOf(root, node);
    if (!seg) {
        // Between segments (e.g. a child index of the root): the next segment's start, or the end.
        const point = document.createRange();
        point.setStart(node, offset);
        for (const s of segments(root)) {
            if (point.comparePoint(s.el, 0) >= 0) return s.start;
        }
        return getTextLength(root);
    }
    let pos = parseStart(seg) ?? 0;
    const before = document.createRange();
    before.setStart(seg, 0);
    before.setEnd(node, offset);
    for (const t of textNodes(seg)) {
        if (t === node) return pos + Math.min(offset, t.data.length);
        if (
            before.comparePoint(t, 0) !== 0 ||
            before.comparePoint(t, t.data.length) !== 0
        )
            break;
        pos += t.data.length;
    }
    return pos;
}

/** The original text rendered in `root`: its counted text nodes, decorations excluded. */
export function renderedText(root: Element): string {
    return textNodes(root)
        .map((t) => t.data)
        .join('');
}

/** Total length of the original text rendered in `root` (decorations excluded). */
export function getTextLength(root: Element): number {
    const segs = segments(root);
    if (segs.length === 0) return textLength(root);
    let max = 0;
    for (const s of segs) max = Math.max(max, s.start + textLength(s.el));
    return max;
}

/**
 * The outermost element of the segment covering original-text position `pos`,
 * or `null` when `pos` lies outside the text. Segments are contiguous, so it
 * is the last segment starting at or before `pos`.
 */
export function segmentElementAt(root: Element, pos: number): Element | null {
    if (pos < 0 || pos >= getTextLength(root)) return null;
    let covering: Element | null = null;
    for (const s of segments(root)) {
        if (s.start > pos) break;
        covering = s.el;
    }
    return covering;
}

/**
 * The selection's extent in original-text indices, clipped to `root`.
 * Returns `null` when there is no selection, it is collapsed, it does not
 * overlap `root`, or the clipped range is empty.
 */
export function getSelectionOffsets(
    root: Element,
    selection?: Selection | null,
): TextRange | null {
    const sel =
        selection ??
        (typeof window !== 'undefined' ? window.getSelection() : null);
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const first = sel.getRangeAt(0);
    const last = sel.getRangeAt(sel.rangeCount - 1);

    const rootRange = document.createRange();
    rootRange.selectNodeContents(root);

    // No overlap: selection ends at/before root starts, or starts at/after root ends.
    // (`a.compareBoundaryPoints(START_TO_END, b)` compares a's end with b's start;
    // `END_TO_START` compares a's start with b's end.)
    if (last.compareBoundaryPoints(Range.START_TO_END, rootRange) <= 0)
        return null;
    if (first.compareBoundaryPoints(Range.END_TO_START, rootRange) >= 0)
        return null;

    const start =
        first.compareBoundaryPoints(Range.START_TO_START, rootRange) <= 0
            ? 0
            : positionOf(root, first.startContainer, first.startOffset);
    const end =
        last.compareBoundaryPoints(Range.END_TO_END, rootRange) >= 0
            ? getTextLength(root)
            : positionOf(root, last.endContainer, last.endOffset);

    return start < end ? { start, end } : null;
}

/**
 * Boundary point for original-text position `pos`.
 * `preferEnd` places a position that sits on a node edge at the end of the
 * preceding text node (for range ends) instead of the start of the next one.
 */
function locate(
    root: Element,
    segs: SegmentInfo[],
    pos: number,
    preferEnd: boolean,
): [Node, number] {
    for (let i = 0; i < segs.length; i++) {
        const { el, start } = segs[i];
        const nodes = textNodes(el);
        let len = 0;
        for (const t of nodes) len += t.data.length;
        const inside = preferEnd
            ? pos > start && pos <= start + len
            : pos >= start && pos < start + len;
        const isLast = i === segs.length - 1;
        if (!inside && !(isLast && pos >= start)) continue;
        let rest = Math.min(pos - start, len);
        for (const t of nodes) {
            if (preferEnd ? rest <= t.data.length : rest < t.data.length)
                return [t, rest];
            rest -= t.data.length;
        }
        const tail = nodes[nodes.length - 1];
        return tail ? [tail, tail.data.length] : [el, el.childNodes.length];
    }
    // Before the first segment (pos 0 with preferEnd) or no segments at all.
    const head = segs[0] ? textNodes(segs[0].el)[0] : textNodes(root)[0];
    return head ? [head, 0] : [root, 0];
}

/**
 * A DOM Range covering original-text `[start, end)` inside `root`.
 * Offsets are clamped to `[0, getTextLength(root)]`; returns `null` when an
 * offset is not a number or `start > end`. `start === end` yields a collapsed range.
 */
export function createRangeFromOffsets(
    root: Element,
    start: number,
    end: number,
): Range | null {
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) return null;
    const length = getTextLength(root);
    const s = Math.max(0, Math.min(start, length));
    const e = Math.max(0, Math.min(end, length));
    const segs = segments(root);
    const range = document.createRange();
    const [sn, so] = locate(root, segs, s, false);
    range.setStart(sn, so);
    if (e === s) {
        range.collapse(true);
    } else {
        const [en, eo] = locate(root, segs, e, true);
        range.setEnd(en, eo);
    }
    return range;
}

interface CaretPoint {
    node: Node;
    offset: number;
}

function caretAt(x: number, y: number): CaretPoint | null {
    const doc = document as Document & {
        caretPositionFromPoint?: (
            x: number,
            y: number,
        ) => { offsetNode: Node; offset: number } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    if (typeof doc.caretPositionFromPoint === 'function') {
        const p = doc.caretPositionFromPoint(x, y);
        return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (typeof doc.caretRangeFromPoint === 'function') {
        const r = doc.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
}

function rangeContainsPoint(range: Range, x: number, y: number): boolean {
    for (const r of range.getClientRects()) {
        if (x >= r.left && x < r.right && y >= r.top && y < r.bottom)
            return true;
    }
    return false;
}

/**
 * Original-text index of the character under the viewport point (`clientX`, `clientY`).
 * Browsers report the nearest caret position, which is the index *after* the
 * character when the point is on its right half; this corrects that so the
 * result is the character under the point. Returns `null` when the point is
 * outside `root` or on a `[data-om-skip]` decoration.
 */
export function getOffsetFromPoint(
    root: Element,
    clientX: number,
    clientY: number,
): number | null {
    const caret = caretAt(clientX, clientY);
    if (!caret || !root.contains(caret.node) || isSkipped(root, caret.node))
        return null;
    // Caret APIs snap to the nearest text, so a point on a decoration's edge can
    // resolve to neighbouring text; hit-test the element actually under the point too.
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit && root.contains(hit) && isSkipped(root, hit)) return null;
    const pos = positionOf(root, caret.node, caret.offset);
    if (pos <= 0) return pos;
    // The character before the caret may be a surrogate pair (two code units).
    const width =
        isLowSurrogate(codeUnitAt(root, pos - 1)) &&
        isHighSurrogate(codeUnitAt(root, pos - 2))
            ? 2
            : 1;
    const prev = createRangeFromOffsets(root, pos - width, pos);
    return prev && rangeContainsPoint(prev, clientX, clientY)
        ? pos - width
        : pos;
}

function codeUnitAt(root: Element, pos: number): number {
    if (pos < 0) return NaN;
    const [node, offset] = locate(root, segments(root), pos, false);
    return node.nodeType === Node.TEXT_NODE
        ? (node as Text).data.charCodeAt(offset)
        : NaN;
}
