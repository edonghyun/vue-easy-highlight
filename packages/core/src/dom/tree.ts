/**
 * Where a root lives: its document, the tree it is in (that document, or a
 * shadow root) and the selection and focus seen from there. Everything is
 * read from the root itself, never from the global `document` or `window`,
 * so a root inside an iframe, a popup or a shadow root works; and node kinds
 * are told by `nodeType`, since `instanceof` fails for another realm's nodes.
 */

const ELEMENT_NODE = 1;
const DOCUMENT_FRAGMENT_NODE = 11;

/** True when `value` is a DOM node of any realm. */
export function isNode(value: unknown): value is Node {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Node).nodeType === 'number'
    );
}

/** True when `value` is an element of any realm. */
export function isElement(value: unknown): value is Element {
    return isNode(value) && value.nodeType === ELEMENT_NODE;
}

/** The shadow root `node` is in, or `null` when it is in a document or detached. */
export function shadowRootOf(node: Node): ShadowRoot | null {
    const tree = node.getRootNode();
    return tree.nodeType === DOCUMENT_FRAGMENT_NODE && 'host' in tree
        ? (tree as ShadowRoot)
        : null;
}

/** The shadow roots around `node`, innermost first. */
function shadowRootsAround(node: Node): ShadowRoot[] {
    const out: ShadowRoot[] = [];
    for (let s = shadowRootOf(node); s; s = shadowRootOf(s.host)) out.push(s);
    return out;
}

/** The selection of `node`'s own window: an iframe's, for a node inside one. */
export function selectionOf(node: Node): Selection | null {
    return node.ownerDocument?.defaultView?.getSelection() ?? null;
}

/**
 * The ranges of `selection`, with boundary points that may lie inside the
 * shadow roots around `node` instead of being retargeted to their hosts:
 * `getComposedRanges` where the engine has it. Without it (Chromium before
 * 137), the window selection's own ranges, which Chromium reports inside the
 * shadow root for a selection made there.
 */
export function rangesOf(
    selection: Selection,
    node: Node,
): readonly AbstractRange[] {
    const shadowRoots = shadowRootsAround(node);
    if (
        shadowRoots.length > 0 &&
        typeof selection.getComposedRanges === 'function'
    ) {
        try {
            return selection.getComposedRanges({ shadowRoots });
        } catch {
            // Safari 17 takes the shadow roots as arguments.
            const legacy = selection.getComposedRanges as unknown as (
                ...roots: ShadowRoot[]
            ) => StaticRange[];
            return legacy.apply(selection, shadowRoots);
        }
    }
    const out: Range[] = [];
    for (let i = 0; i < selection.rangeCount; i++)
        out.push(selection.getRangeAt(i));
    return out;
}

/** True when `node`'s window has no selection, or only collapsed ranges. */
export function isSelectionCollapsed(node: Node): boolean {
    const selection = selectionOf(node);
    return !selection || rangesOf(selection, node).every((r) => r.collapsed);
}

/** The focused element of the tree `node` is in, or `null` (also when it is detached). */
export function activeElementOf(node: Node): Element | null {
    const tree = node.getRootNode() as Partial<DocumentOrShadowRoot>;
    return tree.activeElement ?? null;
}

/** The topmost element at viewport point (`x`, `y`) of the tree `node` is in. */
export function elementAt(node: Node, x: number, y: number): Element | null {
    const tree = (shadowRootOf(node) ?? node.ownerDocument) as {
        elementFromPoint?: (x: number, y: number) => Element | null;
    } | null;
    return tree?.elementFromPoint?.(x, y) ?? null;
}

/**
 * The caret position at viewport point (`x`, `y`) in `node`'s document,
 * reaching into the shadow roots around `node`. Engines without
 * `caretPositionFromPoint` (older WebKit and Chromium) report a point inside
 * a shadow root at its host.
 */
export function caretAt(
    node: Node,
    x: number,
    y: number,
): { node: Node; offset: number } | null {
    const doc = node.ownerDocument as
        | (Document & {
              caretPositionFromPoint?: Document['caretPositionFromPoint'];
              caretRangeFromPoint?: (x: number, y: number) => Range | null;
          })
        | null;
    if (!doc) return null;
    if (typeof doc.caretPositionFromPoint === 'function') {
        const p = doc.caretPositionFromPoint(x, y, {
            shadowRoots: shadowRootsAround(node),
        });
        return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (typeof doc.caretRangeFromPoint === 'function') {
        const r = doc.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
}

/**
 * Where boundary point (`node`, `offset`) lies relative to the contents of
 * `root`: before (-1), inside (0, with the point moved into `root`'s tree) or
 * after (1). A point inside a shadow root under `root`'s tree stands at that
 * shadow root's host; a point in a tree around `root`'s is compared with the
 * host that contains `root`, and one in that host's own children counts as
 * before. `null` when the point and `root` share no tree (another document,
 * or `root` detached), or when `offset` is past the end of `node`: WebKit can
 * report a selection inside a shadow root whose nodes a re-render changed.
 */
export function placeOf(
    root: Element,
    node: Node,
    offset: number,
): { where: -1 | 0 | 1; node: Node; offset: number } | null {
    // The trees from root's outwards, each with what stands for root in it.
    const trees: { tree: Node; stand: Node }[] = [];
    for (let stand: Node = root; ;) {
        const tree = stand.getRootNode();
        trees.push({ tree, stand });
        const shadow = shadowRootOf(stand);
        if (!shadow) break;
        stand = shadow.host;
    }
    if (offset > lengthOf(node)) return null;
    let n = node;
    let o = offset;
    for (;;) {
        const tree = n.getRootNode();
        const level = trees.findIndex((t) => t.tree === tree);
        if (level === 0) {
            const range = root.ownerDocument.createRange();
            range.selectNodeContents(root);
            return {
                where: sign(range.comparePoint(n, o)),
                node: n,
                offset: o,
            };
        }
        if (level > 0) {
            const range = root.ownerDocument.createRange();
            range.selectNode(trees[level].stand);
            const c = range.comparePoint(n, o);
            return { where: c > 0 ? 1 : -1, node: n, offset: o };
        }
        const shadow = shadowRootOf(n);
        if (!shadow) return null;
        n = shadow.host;
        o = 0;
    }
}

/** The length of `node` as a boundary point counts it: its characters, or its children. */
function lengthOf(node: Node): number {
    return 'data' in node
        ? (node as CharacterData).length
        : node.childNodes.length;
}

function sign(c: number): -1 | 0 | 1 {
    return c < 0 ? -1 : c > 0 ? 1 : 0;
}
