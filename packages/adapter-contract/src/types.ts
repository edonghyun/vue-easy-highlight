import type {
    Highlight,
    HoverDetail,
    PointDetail,
    SelectDetail,
    Strategy,
} from '@overlapmark/core';

/** The inputs every adapter accepts, in the adapter-neutral form the suite uses. */
export interface ContractProps {
    text: string;
    highlights: readonly Highlight[];
    strategy?: Strategy;
    focusable?: boolean;
    minSelectionLength?: number;
    touchSelectionDelay?: number;
}

export type AdapterEvent =
    | { type: 'select'; detail: SelectDetail }
    | { type: 'click' | 'dblclick'; detail: PointDetail }
    | { type: 'hover'; detail: HoverDetail };

export interface MountedAdapter {
    /** The element carrying class `om-root`. */
    readonly root: HTMLElement;
    /**
     * Every emitted event, in order; the factory maps emits / on* props / h.on() into it.
     *
     * Two requirements the suite relies on:
     * - Push synchronously with `events.push`, inside the core callback that
     *   produced the event. Tests assert right after a synchronous dispatch (or
     *   after `settle()`), so an event recorded on a later tick or microtask is
     *   missed; and some tests wrap `push` to look at the page at the moment an
     *   event is recorded.
     * - Keep the caller's objects. `detail.highlights` must hold the very
     *   `Highlight` objects passed in `ContractProps` (the suite checks identity
     *   with `toBe`), not reactive proxies or copies. Framework adapters keep
     *   identity by holding props in `shallowRef`/`shallowReactive` or the
     *   framework's equivalent.
     */
    readonly events: readonly AdapterEvent[];
    /** Resolves after the framework flushed the DOM (nextTick / act / flushSync). */
    update(next: Partial<ContractProps>): Promise<void>;
    unmount(): Promise<void>;
}

export interface AdapterFactory {
    name: string;
    /** Renders `props` inside `host`, which the suite created and attached to the document. */
    mount(host: HTMLElement, props: ContractProps): Promise<MountedAdapter>;
}
