import type {
    Highlight,
    HoverDetail,
    PointDetail,
    Segment,
    Overlap,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';

/** The inputs every adapter accepts, in the adapter-neutral form the suite uses. */
export interface ContractProps {
    text: string;
    highlights: readonly Highlight[];
    strategy?: Strategy;
    overlap?: Overlap;
    focusable?: boolean;
    /** Color of highlights without `color`: passed to `brush`, and set on the root. */
    defaultColor?: string;
    /** Returns the CSS image value of `--om-brush` for a color. */
    brush?: (color: string) => string;
    /** Words the accessible description of a focusable segment from the highlights covering it. */
    describe?: (highlights: readonly Highlight[]) => string;
    minSelectionLength?: number;
    touchSelectionDelay?: number;
    /**
     * Decoration text for each highlighted segment (style tier 3). The
     * factory maps it onto the adapter's decoration API; the adapter renders
     * it as `<span data-om-skip aria-hidden="true">text</span>` right after
     * the text of the segment's innermost element. Plain segments, and
     * segments it returns `''` for, get none. The suite itself never returns
     * `''`: the Svelte adapter renders an empty container for a decoration
     * snippet that renders nothing.
     */
    decoration?: (segment: Segment) => string;
}

export type AdapterEvent =
    | { type: 'select'; detail: SelectDetail }
    | { type: 'click' | 'dblclick'; detail: PointDetail }
    | { type: 'hover'; detail: HoverDetail };

/**
 * Receives every event the adapter emits; the suite owns the record. The
 * factory maps emits / on* props / h.on() onto it.
 *
 * Two requirements the suite relies on:
 * - Call it synchronously, inside the core callback that produced the event.
 *   Tests assert right after a synchronous dispatch (or after `settle()`), so
 *   an event delivered on a later tick or microtask is missed; and some tests
 *   read the page at the moment an event is recorded.
 * - Pass the caller's objects on. `detail.highlights` must hold the very
 *   `Highlight` objects given in `ContractProps` (the suite checks identity
 *   with `toBe`), not reactive proxies or copies. Framework adapters keep
 *   identity by holding props in `shallowRef`/`shallowReactive` or the
 *   framework's equivalent.
 */
export type RecordEvent = (event: AdapterEvent) => void;

export interface MountedAdapter {
    /** The element carrying class `om-root`. */
    readonly root: HTMLElement;
    /**
     * Applies `next` and resolves after the framework flushed the DOM
     * (nextTick / act / flushSync).
     *
     * Restore the selection and the focused segment in the same synchronous
     * DOM flush as the patch, before control returns to the event loop. Core
     * re-checks the hovered segment in a mutation observer, whose microtask
     * runs right after that flush; a selection or focus restored later (on
     * another microtask or tick) is not in place when a hover `leave` it
     * causes is recorded.
     */
    update(next: Partial<ContractProps>): Promise<void>;
    unmount(): Promise<void>;
}

export interface AdapterFactory {
    name: string;
    /**
     * Renders `props` inside `host`, which the suite created and attached to
     * the document, and passes every emitted event to `record`.
     */
    mount(
        host: HTMLElement,
        props: ContractProps,
        record: RecordEvent,
    ): Promise<MountedAdapter>;
}
