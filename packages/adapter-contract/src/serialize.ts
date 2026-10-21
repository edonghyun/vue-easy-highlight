/**
 * A rendered tree reduced to what the DOM contract (spec §4.6) promises:
 * tags, class tokens, attributes, inline style properties and text.
 * Class tokens are sorted because their order carries no meaning.
 */
export interface ElementTree {
    tag: string;
    classes: string[];
    attrs: Record<string, string>;
    style: Record<string, string>;
    children: TreeNode[];
}

export type TreeNode = ElementTree | string;

/** The root element: its tag is the adapter's choice, so it is not part of the contract. */
export type RootTree = Omit<ElementTree, 'tag' | 'style'>;

export function classTokens(className: string): string[] {
    return className.split(/\s+/).filter(Boolean).sort();
}

function attributesOf(el: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const { name, value } of el.attributes) {
        if (name !== 'class' && name !== 'style') attrs[name] = value;
    }
    return attrs;
}

function styleOf(el: HTMLElement): Record<string, string> {
    const style: Record<string, string> = {};
    for (let i = 0; i < el.style.length; i++) {
        const name = el.style.item(i);
        style[name] = el.style.getPropertyValue(name);
    }
    return style;
}

/**
 * Comment nodes (framework anchors) are dropped and adjacent text nodes are
 * merged. Whitespace text is kept: it is part of `textContent`, so an adapter
 * that inserts it between segments shifts every offset and must fail.
 */
function childrenOf(parent: Node): TreeNode[] {
    const children: TreeNode[] = [];
    for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? '';
            if (text === '') continue;
            const last = children.length - 1;
            if (typeof children[last] === 'string') children[last] += text;
            else children.push(text);
        } else if (node instanceof HTMLElement) {
            children.push({
                tag: node.tagName.toLowerCase(),
                classes: classTokens(node.className),
                attrs: attributesOf(node),
                style: styleOf(node),
                children: childrenOf(node),
            });
        }
    }
    return children;
}

/** Reads the live DOM under `root` into the shape `expectedTree` produces. */
export function serializeRoot(root: HTMLElement): RootTree {
    return {
        classes: classTokens(root.className),
        attrs: attributesOf(root),
        children: childrenOf(root),
    };
}
