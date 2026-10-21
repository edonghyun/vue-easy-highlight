// Highlighter behaviors outside the shared adapter contract, which
// highlighter.contract.browser.test.ts runs on it: attributes on the root,
// the decoration snippet, caller highlights held in Svelte state, re-passing
// equal props, and removal and remounting. Nothing here waits a fixed time:
// tests run Svelte's flush with flushSync, or await the real selectionchange
// or the gesture helpers.
import {
    REPLACED_TEXT,
    TEXT,
    a,
    b,
    c,
    charPosition,
    clearSelectionAndWait,
    givenPointerOutsideRoots,
    partialOverlap,
    segmentElement,
    release,
    selectAndWait,
    settle,
} from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type {
    Highlight,
    HoverDetail,
    PointDetail,
    Segment,
    SelectDetail,
} from '@overlapmark/core';
import { getSelectionOffsets } from '@overlapmark/core/dom';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import type { Component } from 'svelte';
import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Highlighter } from '../src/lib';
import type { HighlighterProps } from '../src/lib';
import OverlapDecoration from './OverlapDecoration.svelte';
import Shown from './Shown.svelte';
import { deepState, rawState } from './state.svelte';

/** `partialOverlap` as Highlighter props. */
const overlap = {
    text: partialOverlap.text,
    highlights: partialOverlap.highlights,
};

/** What a test's Highlighter reported, by callback. */
interface Reported {
    clicks: PointDetail[];
    hovers: HoverDetail[];
}

/**
 * Mounts `component` with `props` in a host at the end of the body.
 * Unmounting, host removal and clearing the selection are registered here.
 */
// The constraint of Svelte's own Component type, which a component with
// required props does not satisfy as Record<string, unknown>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function givenMounted<P extends Record<string, any>>(
    component: Component<P>,
    props: NoInfer<P>,
): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    const instance = mount(component, { target: host, props });
    flushSync();
    onTestFinished(async () => {
        await unmount(instance);
        host.remove();
        await clearSelectionAndWait();
    });
    return host;
}

/** The callbacks that record what a Highlighter reports into `reported`. */
function recordingInto(reported: Reported) {
    return {
        onclick: (detail: PointDetail) => reported.clicks.push(detail),
        onhover: (detail: HoverDetail) => reported.hovers.push(detail),
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
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights: [a],
            class: 'article',
            id: 'body-text',
            'aria-label': 'Article body',
        });

        const root = host.firstElementChild!;

        expect(root.tagName).toBe('DIV');
        expect([...root.classList]).toEqual(['om-root', 'article']);
        expect(root.id).toBe('body-text');
        expect(root.getAttribute('aria-label')).toBe('Article body');
    });

    it('sets --om-default-color on the root beside the style the caller passes', () => {
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights: [a],
            defaultColor: '#123456',
            style: 'line-height: 2; --om-default-color: red',
        });

        const root = host.firstElementChild as HTMLElement;

        expect(root.style.lineHeight).toBe('2');
        expect(root.style.getPropertyValue('--om-default-color')).toBe(
            '#123456',
        );
    });

    it('keeps its own root class and strategy attribute over those the caller passes', () => {
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights: [a],
            class: 'article',
            'data-om-strategy': 'depth',
        });

        const root = host.firstElementChild!;

        expect([...root.classList]).toEqual(['om-root', 'article']);
        expect(root.getAttribute('data-om-strategy')).toBe('layers');
    });

    it('gives a DOM handler passed as an attribute the DOM event', () => {
        const received: Event[] = [];
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights: [a],
            onpointerdown: (event: PointerEvent) => received.push(event),
        });
        const down = new PointerEvent('pointerdown', { bubbles: true });

        segmentElement(rootIn(host), 0).dispatchEvent(down);

        expect(received).toEqual([down]);
    });
});

describe('Highlighter: callback props', () => {
    // A callback wired to the DOM as well would be called a second time,
    // with the MouseEvent itself.
    it.each([
        { name: 'onclick', gesture: userEvent.click },
        { name: 'ondblclick', gesture: userEvent.dblClick },
    ] as const)(
        'calls $name once per gesture, with core detail only',
        async ({ name, gesture }) => {
            const received: unknown[] = [];
            const host = givenMounted(Highlighter, {
                ...overlap,
                [name]: (detail: unknown) => received.push(detail),
            });
            const { el, position } = charPosition(rootIn(host), 10);

            await gesture(el, { position });

            expect(received).toEqual([
                expect.objectContaining({ offset: 10, highlights: [a, b] }),
            ]);
        },
    );
});

// Svelte applies a prop change in a flush on a later microtask; the user
// still sees the old segments until then.
describe('Highlighter: between a prop change and its flush', () => {
    it('reports the segments on screen for a click', () => {
        const highlights = rawState<readonly Highlight[]>([a, b]);
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            get highlights() {
                return highlights.value;
            },
            ...recordingInto(reported),
        });
        const shown = segmentElement(rootIn(host), 6);
        highlights.value = [c];

        shown.click();

        expect(reported.clicks).toHaveLength(1);
        expect(reported.clicks[0].highlights).toEqual([a, b]);
        // Precondition: the flush had not run yet.
        expect(segmentElement(rootIn(host), 6)).toBe(shown);
    });

    it('takes the select text from the text on screen', async () => {
        const text = rawState(TEXT);
        const selects: SelectDetail[] = [];
        const host = givenMounted(Highlighter, {
            get text() {
                return text.value;
            },
            highlights: partialOverlap.highlights,
            onselect: (detail) => selects.push(detail),
        });
        const shown = segmentElement(rootIn(host), 6);
        await selectAndWait(rootIn(host), 8, 18);
        text.value = REPLACED_TEXT;

        settle(release);

        expect(selects.map((d) => d.text)).toEqual([TEXT.slice(8, 18)]);
        // Precondition: the flush had not run yet.
        expect(segmentElement(rootIn(host), 6)).toBe(shown);
    });
});

describe('Highlighter: decoration snippet', () => {
    it('renders the snippet for each highlighted segment inside its decoration container', () => {
        const decoration = createRawSnippet((segment: () => Segment) => ({
            render: () => `<b class="count">${segment().depth}</b>`,
        }));
        const host = givenMounted(Highlighter, {
            ...overlap,
            decoration,
        });

        const decorations = [
            ...rootIn(host).querySelectorAll('[data-om-skip]'),
        ];

        // Svelte leaves an empty comment as the snippet's anchor.
        expect(
            decorations.map((el) => el.outerHTML.replaceAll('<!---->', '')),
        ).toEqual(
            ['1', '2', '1'].map(
                (depth) =>
                    `<span data-om-skip="" aria-hidden="true"><b class="count">${depth}</b></span>`,
            ),
        );
    });

    // A snippet is an opaque render function: what it renders is known only
    // once it rendered into the container, so every highlighted segment gets one.
    it('renders an empty container for a segment the snippet renders nothing for', () => {
        const host = givenMounted(OverlapDecoration, overlap);

        const decorations = [
            ...rootIn(host).querySelectorAll('[data-om-skip]'),
        ];

        expect(decorations.map((el) => el.textContent)).toEqual([
            '',
            'overlap',
            '',
        ]);
        expect(rootIn(host).textContent).toBe(
            TEXT.slice(0, 15) + 'overlap' + TEXT.slice(15),
        );
    });
});

// Review Focus 5: a Svelte caller keeps its list in `$state`, and the
// component must neither copy nor re-wrap what it is given.
describe('Highlighter: caller highlights', () => {
    it('reports the very objects of a plain array', async () => {
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights: [a, b],
            ...recordingInto(reported),
        });

        await clickCharacter(rootIn(host), 10);

        expect(reported.clicks).toHaveLength(1);
        expect(reported.clicks[0].highlights[0]).toBe(a);
        expect(reported.clicks[0].highlights[1]).toBe(b);
    });

    it('reports the objects the caller reads from its deep $state array', async () => {
        const highlights = deepState<Highlight[]>([a, b]);
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights,
            ...recordingInto(reported),
        });

        await clickCharacter(rootIn(host), 10);

        expect(reported.clicks).toHaveLength(1);
        expect(reported.clicks[0].highlights[0]).toBe(highlights[0]);
        expect(reported.clicks[0].highlights[1]).toBe(highlights[1]);
    });

    it('renders a highlight pushed into a deep $state array in place, and reports it as the caller reads it', async () => {
        const highlights = deepState<Highlight[]>([a]);
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            highlights,
            ...recordingInto(reported),
        });

        highlights.push(c);
        flushSync();
        await clickCharacter(rootIn(host), 20);

        // `c` covers [10,24): with `a` over [0,15) it adds [10,15) a+c and [15,24) c.
        const root = rootIn(host);
        expect(segmentElement(root, 10).getAttribute('data-om-ids')).toBe(
            'a c',
        );
        expect(segmentElement(root, 15).getAttribute('data-om-ids')).toBe('c');
        expect(reported.clicks[0].highlights).toHaveLength(1);
        expect(reported.clicks[0].highlights[0]).toBe(highlights[1]);
    });

    it('renders a highlight changed in place in a deep $state array', () => {
        const highlights = deepState<Highlight[]>([{ ...a }]);
        const host = givenMounted(Highlighter, { text: TEXT, highlights });

        highlights[0].end = 5;
        flushSync();

        expect(segmentElement(rootIn(host), 0).textContent).toBe('Hello');
    });

    it('reports the very object appended to a $state.raw array', async () => {
        const highlights = rawState<readonly Highlight[]>([a]);
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            get highlights() {
                return highlights.value;
            },
            ...recordingInto(reported),
        });

        highlights.value = [...highlights.value, c];
        flushSync();
        await clickCharacter(rootIn(host), 20);

        expect(reported.clicks).toHaveLength(1);
        expect(reported.clicks[0].highlights[0]).toBe(c);
    });
});

// Review Focus 1: a parent that re-renders builds a new highlights array of
// the same objects; that must not disturb the user.
describe('Highlighter: equal highlights passed again in a new array', () => {
    /** A parent holding `partialOverlap`'s highlights in `$state.raw`, replacing the array to change them. */
    function givenParent(): {
        root: HTMLElement;
        highlights: { value: readonly Highlight[] };
        reported: Reported;
    } {
        const highlights = rawState<readonly Highlight[]>([a, b]);
        const reported: Reported = { clicks: [], hovers: [] };
        const host = givenMounted(Highlighter, {
            text: TEXT,
            get highlights() {
                return highlights.value;
            },
            ...recordingInto(reported),
        });
        return { root: rootIn(host), highlights, reported };
    }

    it('leaves the rendered DOM untouched', () => {
        const { root, highlights } = givenParent();
        const mutations = recordMutations(root);

        highlights.value = [a, b];
        flushSync();

        expect(mutations()).toEqual([]);
        // Live positive control: different highlights do patch the DOM.
        const control = recordMutations(root);
        highlights.value = [a];
        flushSync();
        expect(control()).not.toEqual([]);
    });

    it('keeps the selection where the user made it', async () => {
        const { root, highlights } = givenParent();
        await selectAndWait(root, 8, 18);
        const range = window.getSelection()!.getRangeAt(0);

        highlights.value = [a, b];
        flushSync();

        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.getRangeAt(0)).toBe(range);
    });

    it('keeps the hovered segment without calling onhover', async () => {
        const outside = await givenPointerOutsideRoots();
        const { root, highlights, reported } = givenParent();
        await userEvent.hover(segmentElement(root, 6));
        const mutations = recordMutations(root);

        highlights.value = [a, b];
        flushSync();

        // Core re-checks the hovered segment only in a mutation observer, so
        // with no mutation there is nothing left that could call onhover.
        expect(mutations()).toEqual([]);
        expect(reported.hovers.map((d) => d.type)).toEqual(['enter']);
        // Live positive control: moving out leaves the segment entered first.
        await userEvent.hover(outside);
        expect(reported.hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(reported.hovers[1].segment).toBe(reported.hovers[0].segment);
    });
});

// Review Focus 3: removing it and showing it again leaves exactly one set of
// listeners on the live root.
describe('Highlighter: removal and remounting', () => {
    /** A Highlighter of `partialOverlap` inside `{#if}`; set `shown.value` to toggle it. */
    function givenShown(props: Partial<HighlighterProps> = {}): {
        host: HTMLElement;
        shown: { value: boolean };
    } {
        const shown = rawState(true);
        const host = givenMounted(Shown, {
            get shown() {
                return shown.value;
            },
            props: { ...overlap, ...props },
        });
        return { host, shown };
    }

    // Pins one controller on the new root. A controller left on the old root
    // is out of its sight: nothing reaches that detached root (the contract's
    // teardown cases cover stale segments).
    it('calls onclick once per click after {#if} removes it and shows it again', async () => {
        const reported: Reported = { clicks: [], hovers: [] };
        const { host, shown } = givenShown(recordingInto(reported));
        shown.value = false;
        flushSync();
        shown.value = true;
        flushSync();

        await clickCharacter(rootIn(host), 10);

        expect(reported.clicks.map((d) => d.offset)).toEqual([10]);
    });

    it('calls onhover with the leave, with no pointer event, when {#if} removes it while hovered', async () => {
        await givenPointerOutsideRoots();
        const reported: Reported = { clicks: [], hovers: [] };
        const { host, shown } = givenShown(recordingInto(reported));
        await userEvent.hover(segmentElement(rootIn(host), 6));

        shown.value = false;
        flushSync();

        expect(reported.hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(reported.hovers[1].segment).toBe(reported.hovers[0].segment);
        expect(reported.hovers[1].event).toBeNull();
    });
});
