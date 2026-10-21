import { computeSegments } from '@overlapmark/core';
import type {
    Highlight,
    HoverDetail,
    Overlap,
    PointDetail,
    RenderOptions,
    Segment,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';
import {
    decorationTarget,
    rootAttributes,
    segmentElements,
    segmentKey,
} from '@overlapmark/core/adapter';
import type { ElementSpec } from '@overlapmark/core/adapter';
import {
    attachInteractions,
    captureViewState,
    restoreViewState,
} from '@overlapmark/core/dom';
import type { ViewState } from '@overlapmark/core/dom';
import {
    Component,
    createElement,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type {
    ForwardedRef,
    HTMLAttributes,
    ReactElement,
    ReactNode,
    RefAttributes,
    RefObject,
} from 'react';

/**
 * `useLayoutEffect` in the browser. A server runs no effects at all, and
 * React 18 warns when a server render meets `useLayoutEffect`, so there the
 * same effects are declared with `useEffect`.
 */
const useClientLayoutEffect =
    typeof document === 'undefined' ? useEffect : useLayoutEffect;

/** The props `Highlighter` adds to those of its root `div`. */
export interface HighlighterOwnProps<T = unknown> {
    /** The source text. Positions are UTF-16 indices. */
    text: string;
    /** `{ id, start, end, color?, className?, data? }`; `end` is exclusive. Default `[]`. */
    highlights?: readonly Highlight<T>[];
    /** How overlaps are drawn. Default `'layers'`. */
    strategy?: Strategy;
    /** How nested layers combine with the `layers` strategy. Default `'multiply'`. */
    overlap?: Overlap;
    /** Put `tabindex="0"` and `role="button"` on highlighted segments; Enter/Space calls `onClick`. Default `true`. */
    focusable?: boolean;
    /**
     * Words the accessible description of a focusable segment from the
     * highlights covering it. Default `'1 highlight'` / `` `${n} highlights` ``.
     */
    describe?: (highlights: readonly Highlight<T>[]) => string;
    /** Color of highlights without `color`: set on the root as `--om-default-color` and baked into their `--om-brush`. */
    defaultColor?: string;
    /** Returns a CSS image value for `--om-brush`. */
    brush?: (color: string) => string;
    /** Shorter selections do not call `onSelect`. Default 1. */
    minSelectionLength?: number;
    /**
     * Milliseconds without a selection change before a touch selection calls
     * `onSelect`. Default 500; a change applies from the next selection change.
     */
    touchSelectionDelay?: number;
    /** A confirmed text selection inside the component. */
    onSelect?: (detail: SelectDetail<T>) => void;
    /** A click, or Enter/Space on a focused highlight. Not a DOM `onClick`. */
    onClick?: (detail: PointDetail<T>) => void;
    /** A double click. */
    onDblClick?: (detail: PointDetail<T>) => void;
    /** The mouse entered or left a highlighted segment. */
    onHover?: (detail: HoverDetail<T>) => void;
    /**
     * Decoration for each highlighted segment (style tier 3), such as a count
     * or an icon. It is rendered in `<span data-om-skip aria-hidden="true">`
     * right after the text of the segment's innermost element, so it never
     * counts toward offsets, is left out of selections and copies (with the
     * shipped stylesheet), and is hidden from assistive technology. Keep it
     * presentational: no buttons, links or other focusable content. Return
     * `null`, `undefined`, a boolean, `''` or an empty array to leave a
     * segment undecorated.
     */
    renderDecoration?: (segment: Segment<T>) => ReactNode;
}

/**
 * The props of `Highlighter`: its own, and the attributes of its root `div`.
 * The `div`'s `onSelect`, `onClick` and `onDoubleClick` give way to the
 * component's handlers, which receive core's detail objects; the component
 * renders the children itself.
 */
export type HighlighterProps<T = unknown> = Omit<
    HTMLAttributes<HTMLDivElement>,
    | 'onSelect'
    | 'onClick'
    | 'onDoubleClick'
    | 'children'
    | 'dangerouslySetInnerHTML'
> &
    HighlighterOwnProps<T>;

const NO_HIGHLIGHTS: readonly Highlight<never>[] = [];

/** Core's attribute names React spells differently (it warns on `tabindex`). */
const REACT_PROP_NAMES: Record<string, string> = { tabindex: 'tabIndex' };

/** Core's `attrs` as React props. */
function reactAttrs(attrs: Record<string, string>): Record<string, string> {
    const props: Record<string, string> = {};
    for (const [name, value] of Object.entries(attrs))
        props[REACT_PROP_NAMES[name] ?? name] = value;
    return props;
}

/**
 * The React props of the element `spec` describes. An empty class or style is
 * left out rather than set to nothing, as the other adapters render it.
 */
function propsOfSpec(spec: ElementSpec): Record<string, unknown> {
    const props: Record<string, unknown> = reactAttrs(spec.attrs);
    if (spec.className) props.className = spec.className;
    if (Object.keys(spec.style).length > 0) props.style = spec.style;
    return props;
}

/**
 * Whether React renders nothing for `node`, so the segment gets no decoration
 * container: also `''` and arrays of nothing, which leave no node behind.
 */
function rendersNothing(node: ReactNode): boolean {
    if (Array.isArray(node)) return node.every(rendersNothing);
    return (
        node === null ||
        node === undefined ||
        node === '' ||
        typeof node === 'boolean'
    );
}

/**
 * The elements of one segment, built innermost first; the outermost is keyed
 * by `segmentKey`, so a segment whose covering ids change gets a new element
 * and a hover target is never patched into a different segment.
 */
function segmentElement<T>(
    segment: Segment<T>,
    options: RenderOptions<T>,
    renderDecoration: ((segment: Segment<T>) => ReactNode) | undefined,
): ReactElement {
    const specs = segmentElements(segment, options);
    const target = decorationTarget(segment, specs);
    const content =
        target && renderDecoration ? renderDecoration(segment) : null;
    const decoration =
        target && !rendersNothing(content)
            ? createElement(
                  target.container.tag,
                  propsOfSpec(target.container),
                  content,
              )
            : null;
    // The children of element `i`: the element inside it (or the text), then
    // the decoration if `i` holds it.
    const childrenAt = (i: number, inner: ReactNode): ReactNode[] =>
        decoration && i === target?.index ? [inner, decoration] : [inner];
    let inner: ReactNode = segment.text;
    for (let i = specs.length - 1; i > 0; i--)
        inner = createElement(
            specs[i].tag,
            propsOfSpec(specs[i]),
            ...childrenAt(i, inner),
        );
    return createElement(
        specs[0].tag,
        { key: segmentKey(segment), ...propsOfSpec(specs[0]) },
        ...childrenAt(0, inner),
    );
}

/**
 * Keeps the user's selection and focus in `root` across a re-render of
 * `children`: captured before React mutates the DOM, restored right after,
 * in the same commit, before core's mutation observer re-checks the hovered
 * segment.
 *
 * A class, because only `getSnapshotBeforeUpdate` runs before the commit's
 * DOM mutations. A function component's `useInsertionEffect` runs after its
 * own subtree was mutated, by when replaced segment elements have already
 * taken the selection with them.
 *
 * `componentDidUpdate` restores before `Highlighter`'s own layout effect
 * writes `latest` (children's layout effects run first), so the listeners
 * still hold the previous segments and handlers while it runs. That is safe:
 * restoring calls `addRange` and `focus()`, whose `selectionchange` arrives
 * as a later task and whose focus events core does not listen to, so no
 * listener runs before `latest` is current.
 */
class ViewStateBoundary extends Component<{
    root: RefObject<HTMLElement | null>;
    children: ReactNode;
}> {
    getSnapshotBeforeUpdate(): ViewState | null {
        const root = this.props.root.current;
        return root ? captureViewState(root) : null;
    }

    componentDidUpdate(
        _props: unknown,
        _state: unknown,
        view: ViewState | null,
    ): void {
        const root = this.props.root.current;
        if (root && view) restoreViewState(root, view);
    }

    render(): ReactNode {
        return this.props.children;
    }
}

function HighlighterRender<T>(
    props: HighlighterProps<T>,
    ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
    const {
        text,
        highlights = NO_HIGHLIGHTS,
        strategy,
        overlap,
        focusable,
        describe,
        defaultColor,
        brush,
        minSelectionLength,
        touchSelectionDelay,
        onSelect,
        onClick,
        onDblClick,
        onHover,
        renderDecoration,
        className,
        style,
        ...divProps
    } = props;

    const root = useRef<HTMLDivElement>(null);
    const segments = useMemo(
        () => computeSegments(text, highlights),
        [text, highlights],
    );

    // What the listeners read: the latest handlers and settings, and the
    // segments the DOM shows. Written once the DOM is committed, so a render
    // React discards never reaches them.
    const latest = useRef({
        text,
        segments,
        minSelectionLength,
        touchSelectionDelay,
        onSelect,
        onClick,
        onDblClick,
        onHover,
    });
    useClientLayoutEffect(() => {
        latest.current = {
            text,
            segments,
            minSelectionLength,
            touchSelectionDelay,
            onSelect,
            onClick,
            onDblClick,
            onHover,
        };
    });

    // Attached once per mount; the cleanup detaches before React removes the
    // root, so the leave for a hovered segment reaches the caller.
    useClientLayoutEffect(() => {
        const current = (): typeof latest.current => latest.current;
        return attachInteractions<T>(root.current!, {
            getText: () => current().text,
            getSegments: () => current().segments,
            get minSelectionLength() {
                return current().minSelectionLength;
            },
            get touchSelectionDelay() {
                return current().touchSelectionDelay;
            },
            onSelect: (detail) => current().onSelect?.(detail),
            onClick: (detail) => current().onClick?.(detail),
            onDblclick: (detail) => current().onDblClick?.(detail),
            onHover: (detail) => current().onHover?.(detail),
        });
    }, []);

    // React hands the root to the caller's ref, whichever kind it is: an
    // object, a callback, or (React 19) a callback returning a cleanup, and
    // moves it over when the caller passes another ref. Declared after the
    // attach effect so that, on unmount or hiding, the leave the detach
    // emits still finds the root in the caller's ref.
    useImperativeHandle(ref, () => root.current!, []);

    const options: RenderOptions<T> = {
        strategy,
        overlap,
        focusable,
        describe,
        defaultColor,
        brush,
    };
    const rootSpec = rootAttributes(options);
    // The caller's style, with core's properties over it; none at all when
    // both are empty, so the server renders no empty `style` attribute.
    const rootStyle =
        Object.keys(rootSpec.style).length > 0
            ? { ...style, ...rootSpec.style }
            : style;
    return (
        <ViewStateBoundary root={root}>
            <div
                {...divProps}
                {...reactAttrs(rootSpec.attrs)}
                style={rootStyle}
                ref={root}
                className={
                    className
                        ? `${rootSpec.className} ${className}`
                        : rootSpec.className
                }
            >
                {segments.map((segment) =>
                    segmentElement(segment, options, renderDecoration),
                )}
            </div>
        </ViewStateBoundary>
    );
}

// `forwardRef` passes the ref on in React 18 as in 19; the cast below keeps
// the component generic over the highlights' `data`, which `forwardRef`'s own
// type erases.
const ForwardedHighlighter = forwardRef(HighlighterRender);
ForwardedHighlighter.displayName = 'Highlighter';

/**
 * Renders `text` with overlapping `highlights` in a `div`, and calls
 * `onSelect`, `onClick`, `onDblClick` and `onHover` with core's detail
 * objects. `className`, `style` and the other `div` attributes land on that
 * `div`, and `ref` receives it.
 */
export const Highlighter = ForwardedHighlighter as <T = unknown>(
    props: HighlighterProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement;
