// Highlighter behaviors outside the shared adapter contract, which
// highlighter.contract.browser.test.ts runs on it: attribute fallthrough, the
// decoration slot, caller state held in Vue reactivity, re-passing equal props,
// and remounting through v-if and KeepAlive. Nothing here waits a fixed time:
// tests await Vue's flush, the real selectionchange, or the mutation
// observers a re-render notifies.
import {
    TEXT,
    a,
    b,
    c,
    charPosition,
    clearSelectionAndWait,
    givenPointerOutsideRoots,
    partialOverlap,
    propsOf,
    segmentElement,
    selectAndWait,
} from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    Segment,
} from '@overlapmark/core';
import { getSelectionOffsets } from '@overlapmark/core/dom';
import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, createApp, h, nextTick, ref, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { Highlighter } from '../src';

/** What a test's Highlighter emitted, by event. */
interface Emitted {
    clicks: PointDetail[];
    hovers: HoverDetail[];
}

/**
 * Mounts `render` as an app in a host at the end of the body. Unmounting,
 * host removal and clearing the selection are registered here.
 */
function givenApp(render: () => VNode): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render });
    app.mount(host);
    onTestFinished(async () => {
        app.unmount();
        host.remove();
        await clearSelectionAndWait();
    });
    return host;
}

/** The handlers that record what a Highlighter emits into `emitted`. */
function recordingInto(emitted: Emitted) {
    return {
        onClick: (detail: PointDetail) => emitted.clicks.push(detail),
        onHover: (detail: HoverDetail) => emitted.hovers.push(detail),
    };
}

/** The root of the only Highlighter in `host`. */
function rootIn(host: HTMLElement): HTMLElement {
    return host.querySelector<HTMLElement>('.om-root')!;
}

/** Clicks the character at `offset` of `root` with a real pointer. */
async function clickCharacter(root: HTMLElement, offset: number) {
    const { el, position } = charPosition(root, offset);
    await userEvent.click(el, { position });
}

/** Starts recording every DOM mutation under `root`; call the result to stop and read them. */
function recordMutations(root: HTMLElement): () => MutationRecord[] {
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((delivered) =>
        records.push(...delivered),
    );
    observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
    });
    return () => {
        records.push(...observer.takeRecords());
        observer.disconnect();
        return records;
    };
}

describe('Highlighter: root element', () => {
    it('passes the class and attributes given to the component on to the root div', () => {
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: [a],
                class: 'article',
                id: 'body-text',
                'aria-label': 'Article body',
            }),
        );

        const root = host.firstElementChild!;

        expect(root.tagName).toBe('DIV');
        expect([...root.classList].sort()).toEqual(['article', 'om-root']);
        expect(root.id).toBe('body-text');
        expect(root.getAttribute('aria-label')).toBe('Article body');
    });

    it('keeps its own root class and strategy attribute over those the caller passes', () => {
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: [a],
                class: 'article',
                'data-om-strategy': 'depth',
            }),
        );

        const root = host.firstElementChild!;

        expect([...root.classList].sort()).toEqual(['article', 'om-root']);
        expect(root.getAttribute('data-om-strategy')).toBe('layers');
    });

    it('puts the style and id given to the component on the root div beside om-root', () => {
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: [a],
                style: { lineHeight: '2' },
                id: 'body-text',
            }),
        );

        const root = host.firstElementChild as HTMLElement;

        expect(root.classList.contains('om-root')).toBe(true);
        expect(root.style.lineHeight).toBe('2');
        expect(root.id).toBe('body-text');
    });

    it('gives a native listener passed to the component each DOM event once', () => {
        const received: Event[] = [];
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: [a],
                onPointerdown: (event: PointerEvent) => received.push(event),
            }),
        );
        const down = new PointerEvent('pointerdown', { bubbles: true });

        segmentElement(rootIn(host), 0).dispatchEvent(down);

        expect(received).toEqual([down]);
    });

    it('updates an attribute the caller changes after mounting', async () => {
        const label = ref('Article body');
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: [a],
                'aria-label': label.value,
            }),
        );

        label.value = 'Summary';
        await nextTick();

        expect(host.firstElementChild!.getAttribute('aria-label')).toBe(
            'Summary',
        );
    });
});

describe('Highlighter: decoration slot', () => {
    it('renders the slot content for each highlighted segment inside its decoration container', () => {
        const host = givenApp(() =>
            h(Highlighter, propsOf(partialOverlap), {
                decoration: ({ segment }: { segment: Segment }) =>
                    h('b', { class: 'count' }, String(segment.depth)),
            }),
        );

        const decorations = [
            ...rootIn(host).querySelectorAll('[data-om-skip]'),
        ];

        expect(decorations.map((el) => el.outerHTML)).toEqual(
            ['1', '2', '1'].map(
                (depth) =>
                    `<span data-om-skip="" aria-hidden="true"><b class="count">${depth}</b></span>`,
            ),
        );
    });

    it('leaves out the container of a segment the slot renders nothing for', () => {
        const host = givenApp(() =>
            h(Highlighter, propsOf(partialOverlap), {
                decoration: ({ segment }: { segment: Segment }) =>
                    segment.depth > 1 ? 'overlap' : null,
            }),
        );

        const decorations = [
            ...rootIn(host).querySelectorAll('[data-om-skip]'),
        ];

        // Live positive control: the overlap segment [6,15) is decorated.
        expect(decorations).toHaveLength(1);
        expect(decorations[0].textContent).toBe('overlap');
        expect(decorations[0].closest('[data-om-start]')).toBe(
            segmentElement(rootIn(host), 6),
        );
    });
});

describe('Highlighter: highlights held in deep reactive state', () => {
    it('reports the caller objects behind the reactive proxies', async () => {
        const highlights = ref<Highlight[]>([a, b]);
        const emitted: Emitted = { clicks: [], hovers: [] };
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: highlights.value,
                ...recordingInto(emitted),
            }),
        );

        await clickCharacter(rootIn(host), 10);

        expect(emitted.clicks).toHaveLength(1);
        expect(emitted.clicks[0].highlights[0]).toBe(a);
        expect(emitted.clicks[0].highlights[1]).toBe(b);
    });

    it('renders a highlight pushed into the reactive array in place', async () => {
        const highlights = ref<Highlight[]>([a]);
        const host = givenApp(() =>
            h(Highlighter, { text: TEXT, highlights: highlights.value }),
        );

        highlights.value.push(c);
        await nextTick();

        // `c` covers [10,24): with `a` over [0,15) it adds [10,15) a+c and [15,24) c.
        const root = rootIn(host);
        expect(segmentElement(root, 10).getAttribute('data-ids')).toBe('a,c');
        expect(segmentElement(root, 15).getAttribute('data-ids')).toBe('c');
    });

    it('renders a highlight changed in place', async () => {
        const highlights = ref<Highlight[]>([{ ...a }]);
        const host = givenApp(() =>
            h(Highlighter, { text: TEXT, highlights: highlights.value }),
        );

        highlights.value[0].end = 5;
        await nextTick();

        expect(segmentElement(rootIn(host), 0).textContent).toBe('Hello');
    });
});

// A change made in place to reactive highlights reaches the component at
// once, but Vue patches the DOM in a flush on a later microtask; the user
// still sees the old segments until then.
describe('Highlighter: between a change in place and its flush', () => {
    it('reports the segments on screen for a click', () => {
        const highlights = ref<Highlight[]>([a, b]);
        const emitted: Emitted = { clicks: [], hovers: [] };
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: highlights.value,
                ...recordingInto(emitted),
            }),
        );
        const shown = segmentElement(rootIn(host), 6);
        highlights.value.splice(0, 2, c);

        shown.click();

        expect(emitted.clicks).toHaveLength(1);
        expect(emitted.clicks[0].highlights).toEqual([a, b]);
        // Precondition: the flush had not run yet.
        expect(segmentElement(rootIn(host), 6)).toBe(shown);
    });
});

// Review Focus 1: a parent that re-renders builds a new highlights array of
// the same objects; that must not disturb the user.
describe('Highlighter: equal highlights passed again in a new array', () => {
    /** A parent holding `partialOverlap`'s highlights in a shallow ref, as a typical Vue parent does. */
    function givenParent(): {
        root: HTMLElement;
        highlights: { value: readonly Highlight[] };
        emitted: Emitted;
    } {
        const highlights = shallowRef<readonly Highlight[]>([a, b]);
        const emitted: Emitted = { clicks: [], hovers: [] };
        const host = givenApp(() =>
            h(Highlighter, {
                text: TEXT,
                highlights: highlights.value,
                ...recordingInto(emitted),
            }),
        );
        return { root: rootIn(host), highlights, emitted };
    }

    it('leaves the rendered DOM untouched', async () => {
        const { root, highlights } = givenParent();
        const mutations = recordMutations(root);

        highlights.value = [a, b];
        await nextTick();

        expect(mutations()).toEqual([]);
        // Live positive control: different highlights do patch the DOM.
        const control = recordMutations(root);
        highlights.value = [a];
        await nextTick();
        expect(control()).not.toEqual([]);
    });

    it('keeps the selection where the user made it', async () => {
        const { root, highlights } = givenParent();
        await selectAndWait(root, 8, 18);
        const range = window.getSelection()!.getRangeAt(0);

        highlights.value = [a, b];
        await nextTick();

        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.getRangeAt(0)).toBe(range);
    });

    it('keeps the hovered segment without emitting hover', async () => {
        const outside = await givenPointerOutsideRoots();
        const { root, highlights, emitted } = givenParent();
        await userEvent.hover(segmentElement(root, 6));
        const mutations = recordMutations(root);

        highlights.value = [a, b];
        await nextTick();

        // Core re-checks the hovered segment only in a mutation observer, so
        // with no mutation there is nothing left that could emit.
        expect(mutations()).toEqual([]);
        expect(emitted.hovers.map((d) => d.type)).toEqual(['enter']);
        // Live positive control: moving out leaves the segment entered first.
        await userEvent.hover(outside);
        expect(emitted.hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(emitted.hovers[1].segment).toBe(emitted.hovers[0].segment);
    });
});

// Review Focus 3: unmounting and mounting again, or KeepAlive deactivating
// and activating, leaves exactly one set of listeners on the live root.
describe('Highlighter: remounting', () => {
    // Pins one controller on the new root. A controller left on the old root
    // is out of its sight: nothing reaches that detached root (the contract's
    // teardown cases cover stale segments).
    it('emits one click per click after v-if unmounts and mounts it again', async () => {
        const shown = ref(true);
        const emitted: Emitted = { clicks: [], hovers: [] };
        const host = givenApp(() =>
            h('section', [
                shown.value
                    ? h(Highlighter, {
                          ...propsOf(partialOverlap),
                          ...recordingInto(emitted),
                      })
                    : null,
            ]),
        );
        shown.value = false;
        await nextTick();
        shown.value = true;
        await nextTick();

        await clickCharacter(rootIn(host), 10);

        expect(emitted.clicks.map((d) => d.offset)).toEqual([10]);
    });

    // Detaching after the root left the document would hand the caller a
    // leave for a segment no longer on the page.
    it('emits the unmount leave while its root is still in the document', async () => {
        await givenPointerOutsideRoots();
        const shown = ref(true);
        const leaves: { connected: boolean }[] = [];
        const host = givenApp(() =>
            h('section', [
                shown.value
                    ? h(Highlighter, {
                          ...propsOf(partialOverlap),
                          onHover: (detail: HoverDetail) => {
                              if (detail.type === 'leave')
                                  leaves.push({ connected: root.isConnected });
                          },
                      })
                    : null,
            ]),
        );
        const root = rootIn(host);
        await userEvent.hover(segmentElement(root, 6));

        shown.value = false;
        await nextTick();

        expect(leaves).toEqual([{ connected: true }]);
    });

    describe('inside KeepAlive', () => {
        /** A Highlighter KeepAlive caches while `shown` is false. */
        function givenKeptAlive(): {
            host: HTMLElement;
            shown: { value: boolean };
            emitted: Emitted;
        } {
            const shown = ref(true);
            const emitted: Emitted = { clicks: [], hovers: [] };
            const handlers = recordingInto(emitted);
            const host = givenApp(() =>
                h(KeepAlive, null, [
                    shown.value
                        ? h(Highlighter, {
                              ...propsOf(partialOverlap),
                              ...handlers,
                          })
                        : null,
                ]),
            );
            return { host, shown, emitted };
        }

        it('emits one click per click after it is deactivated and activated again', async () => {
            const { host, shown, emitted } = givenKeptAlive();
            const root = rootIn(host);
            shown.value = false;
            await nextTick();
            shown.value = true;
            await nextTick();

            // Precondition: KeepAlive kept the instance, so this is no remount.
            expect(rootIn(host)).toBe(root);

            await clickCharacter(root, 10);

            expect(emitted.clicks.map((d) => d.offset)).toEqual([10]);
        });

        it('emits leave, with no pointer event, for the hovered segment when deactivated', async () => {
            await givenPointerOutsideRoots();
            const { host, shown, emitted } = givenKeptAlive();
            await userEvent.hover(segmentElement(rootIn(host), 6));

            shown.value = false;
            await nextTick();

            expect(emitted.hovers.map((d) => d.type)).toEqual([
                'enter',
                'leave',
            ]);
            expect(emitted.hovers[1].segment).toBe(emitted.hovers[0].segment);
            expect(emitted.hovers[1].event).toBeNull();
        });
    });
});
