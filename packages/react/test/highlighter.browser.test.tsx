// Highlighter behaviors outside the shared adapter contract, which
// highlighter.contract.browser.test.tsx runs on it: div props, handlers that
// are not DOM handlers, renderDecoration, re-passing equal props, StrictMode,
// changing handlers, and unmounting while hovered. Nothing here waits a fixed
// time: renders go through flushSync, and tests await the real
// selectionchange or the mutation observers a re-render notifies.
import {
    TEXT,
    a,
    b,
    charPosition,
    clearSelectionAndWait,
    givenPointerOutsideRoots,
    partialOverlap,
    propsOf,
    segmentElement,
    selectAndWait,
} from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type { Highlight, HoverDetail, PointDetail } from '@overlapmark/core';
import { getSelectionOffsets } from '@overlapmark/core/dom';
import {
    Activity,
    StrictMode,
    createRef,
    startTransition,
    useLayoutEffect,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Highlighter } from '../src';

/** A React root showing `node` in a host at the end of the body. */
interface Rendered {
    host: HTMLElement;
    /** Renders `next` in place of what the root shows, flushed before it returns. */
    rerender(next: ReactNode): void;
}

/**
 * Renders `node` into a new React root, flushed before it returns.
 * Unmounting, host removal and clearing the selection are registered here.
 */
function givenRendered(node: ReactNode): Rendered {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    flushSync(() => root.render(node));
    onTestFinished(async () => {
        root.unmount();
        host.remove();
        await clearSelectionAndWait();
    });
    return {
        host,
        rerender: (next) => flushSync(() => root.render(next)),
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
    it('passes the className, style and other div props on to the root div', () => {
        const { host } = givenRendered(
            <Highlighter
                text={TEXT}
                highlights={[a]}
                className="article"
                style={{ lineHeight: '2' }}
                id="body-text"
                aria-label="Article body"
                data-testid="highlighter"
            />,
        );

        const root = host.firstElementChild as HTMLElement;

        expect(root.tagName).toBe('DIV');
        expect([...root.classList]).toEqual(['om-root', 'article']);
        expect(root.style.lineHeight).toBe('2');
        expect(root.id).toBe('body-text');
        expect(root.getAttribute('aria-label')).toBe('Article body');
        expect(root.dataset.testid).toBe('highlighter');
    });

    it('sets --om-default-color on the root beside the style the caller passes', () => {
        const { host } = givenRendered(
            <Highlighter
                text={TEXT}
                highlights={[a]}
                defaultColor="#123456"
                style={
                    {
                        lineHeight: '2',
                        '--om-default-color': 'red',
                    } as CSSProperties
                }
            />,
        );

        const root = host.firstElementChild as HTMLElement;

        expect(root.style.lineHeight).toBe('2');
        expect(root.style.getPropertyValue('--om-default-color')).toBe(
            '#123456',
        );
    });

    it('keeps its own root class and strategy attribute over those the caller passes', () => {
        const { host } = givenRendered(
            <Highlighter
                text={TEXT}
                highlights={[a]}
                className="article"
                data-om-strategy="depth"
            />,
        );

        const root = host.firstElementChild as HTMLElement;

        expect([...root.classList]).toEqual(['om-root', 'article']);
        expect(root.getAttribute('data-om-strategy')).toBe('layers');
    });

    it('hands the root div to an object ref', () => {
        const ref = createRef<HTMLDivElement>();

        const { host } = givenRendered(
            <Highlighter {...propsOf(partialOverlap)} ref={ref} />,
        );

        expect(ref.current).toBe(rootIn(host));
        expect(ref.current?.classList.contains('om-root')).toBe(true);
    });

    it('hands the root div to a callback ref', () => {
        const received: (HTMLDivElement | null)[] = [];

        const { host } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                ref={(el) => {
                    received.push(el);
                }}
            />,
        );

        expect(received).toEqual([rootIn(host)]);
        expect(received[0]?.classList.contains('om-root')).toBe(true);
    });

    // React 19: a callback ref may return a cleanup, which React then calls
    // in place of calling the ref with null.
    it('runs the cleanup a callback ref returns on unmount, instead of calling the ref with null', () => {
        const received: (HTMLDivElement | null)[] = [];
        const cleanedUp: HTMLDivElement[] = [];
        const { host, rerender } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                ref={(el) => {
                    received.push(el);
                    return () => {
                        cleanedUp.push(el!);
                    };
                }}
            />,
        );
        const root = rootIn(host);

        rerender(<section />);

        expect(received).toEqual([root]);
        expect(cleanedUp).toEqual([root]);
    });

    it('hands the root div over to a ref given in place of the first', () => {
        const first = createRef<HTMLDivElement>();
        const second = createRef<HTMLDivElement>();
        const { host, rerender } = givenRendered(
            <Highlighter {...propsOf(partialOverlap)} ref={first} />,
        );
        const root = rootIn(host);

        rerender(<Highlighter {...propsOf(partialOverlap)} ref={second} />);

        expect(first.current).toBeNull();
        expect(second.current).toBe(root);
        expect(rootIn(host)).toBe(root);
    });

    it('clears an object ref on unmount', () => {
        const ref = createRef<HTMLDivElement>();
        const { host, rerender } = givenRendered(
            <Highlighter {...propsOf(partialOverlap)} ref={ref} />,
        );
        expect(ref.current).toBe(rootIn(host));

        rerender(<section />);

        expect(ref.current).toBeNull();
    });

    it('calls a DOM handler given as a div prop with the DOM event', async () => {
        const pointerDowns: Event[] = [];
        const { host } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                onPointerDown={(event) => pointerDowns.push(event.nativeEvent)}
            />,
        );

        await clickCharacter(rootIn(host), 10);

        expect(pointerDowns).toHaveLength(1);
        expect(pointerDowns[0]).toBeInstanceOf(PointerEvent);
    });
});

// onClick and onDblClick share their names with DOM handlers; a component
// that also handed them to the div would call them a second time, with React's
// synthetic event.
describe('Highlighter: on* handlers', () => {
    it('calls onClick once per click, with core detail only', async () => {
        const calls: unknown[] = [];
        const { host } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                onClick={(detail) => calls.push(detail)}
            />,
        );

        await clickCharacter(rootIn(host), 10);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ offset: 10, highlights: [a, b] });
    });

    it('calls onDblClick once per double click, with core detail only', async () => {
        const calls: unknown[] = [];
        const { host } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                onDblClick={(detail) => calls.push(detail)}
            />,
        );
        const { el, position } = charPosition(rootIn(host), 10);

        await userEvent.dblClick(el, { position });

        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ offset: 10, highlights: [a, b] });
    });
});

describe('Highlighter: renderDecoration', () => {
    it('renders the returned node for each highlighted segment inside its decoration container', () => {
        const { host } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                renderDecoration={(segment) => (
                    <b className="count">{segment.depth}</b>
                )}
            />,
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

    const nothing: { label: string; node: ReactNode }[] = [
        { label: 'null', node: null },
        { label: 'undefined', node: undefined },
        { label: 'false', node: false },
        { label: 'an empty string', node: '' },
        { label: 'an empty array', node: [] },
    ];
    it.each(nothing)(
        'leaves out the container of a segment it returns $label for',
        ({ node }) => {
            const { host } = givenRendered(
                <Highlighter
                    {...propsOf(partialOverlap)}
                    renderDecoration={(segment) =>
                        segment.depth > 1 ? 'overlap' : node
                    }
                />,
            );

            const decorations = [
                ...rootIn(host).querySelectorAll('[data-om-skip]'),
            ];

            // Live positive control: the overlap segment [6,15) is decorated.
            expect(decorations).toHaveLength(1);
            expect(decorations[0]!.textContent).toBe('overlap');
            expect(decorations[0]!.closest('[data-om-start]')).toBe(
                segmentElement(rootIn(host), 6),
            );
        },
    );
});

// Review Focus 1: a parent that re-renders builds a new highlights array of
// the same objects; that must not disturb the user.
describe('Highlighter: equal highlights passed again in a new array', () => {
    /** `partialOverlap` rendered with `highlights`, recording hovers into `hovers`. */
    function viewOf(
        highlights: readonly Highlight[],
        hovers: HoverDetail[] = [],
    ): ReactNode {
        return (
            <Highlighter
                text={TEXT}
                highlights={highlights}
                onHover={(detail) => hovers.push(detail)}
            />
        );
    }

    it('leaves the rendered DOM untouched', () => {
        const { host, rerender } = givenRendered(viewOf([a, b]));
        const mutations = recordMutations(rootIn(host));

        rerender(viewOf([a, b]));

        expect(mutations()).toEqual([]);
        // Live positive control: different highlights do patch the DOM.
        const control = recordMutations(rootIn(host));
        rerender(viewOf([a]));
        expect(control()).not.toEqual([]);
    });

    it('keeps the selection where the user made it', async () => {
        const { host, rerender } = givenRendered(viewOf([a, b]));
        const root = rootIn(host);
        await selectAndWait(root, 8, 18);
        const range = window.getSelection()!.getRangeAt(0);

        rerender(viewOf([a, b]));

        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
        expect(window.getSelection()!.getRangeAt(0)).toBe(range);
    });

    it('keeps the hovered segment without calling onHover', async () => {
        const outside = await givenPointerOutsideRoots();
        const hovers: HoverDetail[] = [];
        const { host, rerender } = givenRendered(viewOf([a, b], hovers));
        const root = rootIn(host);
        await userEvent.hover(segmentElement(root, 6));
        const mutations = recordMutations(root);

        rerender(viewOf([a, b], hovers));

        // Core re-checks the hovered segment only in a mutation observer, so
        // with no mutation there is nothing left that could call onHover.
        expect(mutations()).toEqual([]);
        expect(hovers.map((d) => d.type)).toEqual(['enter']);
        // Live positive control: moving out leaves the segment entered first.
        await userEvent.hover(outside);
        expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(hovers[1]!.segment).toBe(hovers[0]!.segment);
    });
});

// Review Focus 3: StrictMode mounts, unmounts and mounts again in
// development; exactly one set of listeners must remain on the root.
describe('Highlighter under StrictMode', () => {
    it('calls onClick once per click', async () => {
        const clicks: PointDetail[] = [];
        const { host } = givenRendered(
            <StrictMode>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    onClick={(detail) => clicks.push(detail)}
                />
            </StrictMode>,
        );

        await clickCharacter(rootIn(host), 10);

        expect(clicks.map((d) => d.offset)).toEqual([10]);
    });

    it('calls onHover once per enter and once per leave', async () => {
        const outside = await givenPointerOutsideRoots();
        const hovers: HoverDetail[] = [];
        const { host } = givenRendered(
            <StrictMode>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    onHover={(detail) => hovers.push(detail)}
                />
            </StrictMode>,
        );

        await userEvent.hover(segmentElement(rootIn(host), 6));
        await userEvent.hover(outside);

        expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
    });
});

describe('Highlighter: handler props changed between renders', () => {
    it('calls the handler of the latest render', async () => {
        const first: PointDetail[] = [];
        const latest: PointDetail[] = [];
        const { host, rerender } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                onClick={(detail) => first.push(detail)}
            />,
        );
        rerender(
            <Highlighter
                {...propsOf(partialOverlap)}
                onClick={(detail) => latest.push(detail)}
            />,
        );

        await clickCharacter(rootIn(host), 10);

        expect(first).toEqual([]);
        expect(latest.map((d) => d.offset)).toEqual([10]);
    });

    // Re-attaching would detach first, which ends the hover with a leave
    // that no pointer caused.
    it('keeps the hovered segment, leaving it only when the pointer does', async () => {
        const outside = await givenPointerOutsideRoots();
        const hovers: HoverDetail[] = [];
        const { host, rerender } = givenRendered(
            <Highlighter
                {...propsOf(partialOverlap)}
                onHover={(detail) => hovers.push(detail)}
            />,
        );
        await userEvent.hover(segmentElement(rootIn(host), 6));

        rerender(
            <Highlighter
                {...propsOf(partialOverlap)}
                onHover={(detail) => hovers.push(detail)}
            />,
        );
        await userEvent.hover(outside);

        expect(hovers.map((d) => d.type)).toEqual(['enter', 'leave']);
        expect(hovers[1]!.event).toBeInstanceOf(PointerEvent);
    });
});

describe('Highlighter: unmounting while a segment is hovered', () => {
    // Detaching after the root left the document would hand the caller a
    // leave for a segment no longer on the page.
    it('calls onHover with the leave while its root is still in the document', async () => {
        await givenPointerOutsideRoots();
        const leaves: { connected: boolean; event: Event | null }[] = [];
        const { host, rerender } = givenRendered(
            <section>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    onHover={(detail) => {
                        if (detail.type === 'leave')
                            leaves.push({
                                connected: root.isConnected,
                                event: detail.event,
                            });
                    }}
                />
            </section>,
        );
        const root = rootIn(host);
        await userEvent.hover(segmentElement(root, 6));

        rerender(<section />);

        expect(leaves).toEqual([{ connected: true, event: null }]);
    });

    it('still hands the root to the caller ref during that leave', async () => {
        await givenPointerOutsideRoots();
        const ref = createRef<HTMLDivElement>();
        const refsOnLeave: (HTMLDivElement | null)[] = [];
        const { host, rerender } = givenRendered(
            <section>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    ref={ref}
                    onHover={(detail) => {
                        if (detail.type === 'leave')
                            refsOnLeave.push(ref.current);
                    }}
                />
            </section>,
        );
        const root = rootIn(host);
        await userEvent.hover(segmentElement(root, 6));

        rerender(<section />);

        expect(refsOnLeave).toEqual([root]);
    });
});

describe('Highlighter: an update rendered as a transition', () => {
    /** Renders `highlights` and calls `onCommit` in the commit that shows them. */
    function Parent(props: {
        highlights: readonly Highlight[];
        onCommit: () => void;
    }) {
        // A parent's layout effect runs after its children's in one commit.
        useLayoutEffect(() => props.onCommit());
        return <Highlighter text={TEXT} highlights={props.highlights} />;
    }

    it('keeps the selection where the user made it', async () => {
        const { host, rerender } = givenRendered(
            <Parent highlights={[a]} onCommit={() => {}} />,
        );
        const root = rootIn(host);
        await selectAndWait(root, 8, 18);

        await new Promise<void>((committed) =>
            startTransition(() =>
                rerender(<Parent highlights={[a, b]} onCommit={committed} />),
            ),
        );

        // Precondition: the transition patched the DOM (a new a+b segment).
        expect(segmentElement(root, 6).getAttribute('data-om-ids')).toBe('a b');
        expect(getSelectionOffsets(root)).toEqual({ start: 8, end: 18 });
    });
});

// Review Focus 3: Activity hides a component by disconnecting its layout
// effects and shows it by connecting them again, keeping the DOM.
describe('Highlighter inside Activity', () => {
    /** `partialOverlap` in an Activity of `mode`, recording clicks into `clicks`. */
    function viewOf(
        mode: 'visible' | 'hidden',
        clicks: PointDetail[],
    ): ReactNode {
        return (
            <Activity mode={mode}>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    onClick={(detail) => clicks.push(detail)}
                />
            </Activity>
        );
    }

    it('calls onClick once per click after it is hidden and shown again', async () => {
        const clicks: PointDetail[] = [];
        const { host, rerender } = givenRendered(viewOf('visible', clicks));
        const root = rootIn(host);
        rerender(viewOf('hidden', clicks));
        rerender(viewOf('visible', clicks));

        // Precondition: Activity kept the DOM, so this is no remount.
        expect(rootIn(host)).toBe(root);

        await clickCharacter(root, 10);

        expect(clicks.map((d) => d.offset)).toEqual([10]);
    });

    it('calls no onClick while hidden', () => {
        const clicks: PointDetail[] = [];
        const { host, rerender } = givenRendered(viewOf('visible', clicks));
        const segment = segmentElement(rootIn(host), 6);
        rerender(viewOf('hidden', clicks));

        segment.click();

        expect(clicks).toEqual([]);
        // Live positive control: the same click once shown again.
        rerender(viewOf('visible', clicks));
        segment.click();
        expect(clicks.map((d) => d.offset)).toEqual([6]);
    });

    it('still hands the root to the caller ref during the leave hiding emits', async () => {
        await givenPointerOutsideRoots();
        const ref = createRef<HTMLDivElement>();
        const refsOnLeave: (HTMLDivElement | null)[] = [];
        const view = (mode: 'visible' | 'hidden'): ReactNode => (
            <Activity mode={mode}>
                <Highlighter
                    {...propsOf(partialOverlap)}
                    ref={ref}
                    onHover={(detail) => {
                        if (detail.type === 'leave')
                            refsOnLeave.push(ref.current);
                    }}
                />
            </Activity>
        );
        const { host, rerender } = givenRendered(view('visible'));
        const root = rootIn(host);
        await userEvent.hover(segmentElement(root, 6));

        rerender(view('hidden'));

        expect(refsOnLeave).toEqual([root]);
    });
});
