// Server rendering and hydration (D8): the markup renderToString produces is
// the DOM contract's tree, the client takes it over without a mismatch, and
// the hydrated component handles events.
import {
    a,
    b,
    charPosition,
    expectedTree,
    partialOverlap,
    propsOf,
    serializeRoot,
} from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type { PointDetail, Segment } from '@overlapmark/core';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createApp, createSSRApp, h } from 'vue';
import type { App, VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Highlighter } from '../src';

const decoration = (segment: Segment): string =>
    `[${segment.highlights.map((h) => h.id).join('+')}]`;

/** A render function showing `props`; `onClick` receives the instance's clicks. */
function viewOf(
    props: ContractProps,
    onClick: (detail: PointDetail) => void = () => {},
): () => VNode {
    const { decoration, ...rest } = propsOf(props);
    return () =>
        h(
            Highlighter,
            { ...rest, onClick },
            decoration && {
                decoration: ({ segment }: { segment: Segment }) =>
                    decoration(segment),
            },
        );
}

/** `props` as an SSR app; `onClick` receives the hydrated instance's clicks. */
function appOf(
    props: ContractProps,
    onClick?: (detail: PointDetail) => void,
): App {
    return createSSRApp({ render: viewOf(props, onClick) });
}

/** Parses server `html` into a host at the end of the body, removed when the test finishes. */
function givenServerMarkup(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    onTestFinished(() => host.remove());
    return host;
}

/** Mounts `props` with a client-only app in a new host; removal and unmounting are registered here. */
function givenClientMount(props: ContractProps): HTMLElement {
    const host = givenServerMarkup('');
    const app = createApp({ render: viewOf(props) });
    app.mount(host);
    onTestFinished(() => app.unmount());
    return host;
}

/** The sorted attribute names of every element under `host`, in document order. */
function attributeNamesOf(host: HTMLElement): string[][] {
    return [...host.querySelectorAll('*')].map((el) =>
        el.getAttributeNames().sort(),
    );
}

/** Hydrates `app` on `host`; unmounting is registered here. */
function hydrate(app: App, host: HTMLElement): void {
    app.mount(host);
    onTestFinished(() => app.unmount());
}

/** Spies on the console channels Vue reports hydration mismatches on. */
function givenConsoleSpies() {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => {
        warn.mockRestore();
        error.mockRestore();
    });
    return { warn, error };
}

// The last case puts a style on the root, which hydration must take over too.
const cases: { label: string; options: Partial<ContractProps> }[] = [
    { label: 'the layers strategy', options: { strategy: 'layers' } },
    { label: 'the depth strategy', options: { strategy: 'depth' } },
    {
        label: 'the darken overlap and a defaultColor',
        options: { overlap: 'darken', defaultColor: '#123456' },
    },
];

describe.each(cases)(
    'Highlighter SSR with $label and decorations',
    ({ options }) => {
        const props: ContractProps = {
            ...partialOverlap,
            ...options,
            decoration,
        };

        it('renders on the server the tree of the DOM contract', async () => {
            const html = await renderToString(appOf(props));

            const host = givenServerMarkup(html);

            expect(
                serializeRoot(host.firstElementChild as HTMLElement),
            ).toEqual(expectedTree(props));
        });

        // serializeRoot reads style through the CSSOM, so an empty `style`
        // attribute only shows in the attribute names.
        it('renders on the server the attributes a client mount renders on each element', async () => {
            const server = givenServerMarkup(
                await renderToString(appOf(props)),
            );

            const client = givenClientMount(props);

            expect(attributeNamesOf(server)).toEqual(attributeNamesOf(client));
            expect(
                serializeRoot(server.firstElementChild as HTMLElement),
            ).toEqual(serializeRoot(client.firstElementChild as HTMLElement));
        });

        it('hydrates the server markup without a mismatch warning', async () => {
            const host = givenServerMarkup(await renderToString(appOf(props)));
            const spies = givenConsoleSpies();

            hydrate(appOf(props), host);

            expect(spies.warn).not.toHaveBeenCalled();
            expect(spies.error).not.toHaveBeenCalled();
            // Live positive control: markup of other highlights does warn.
            const other = givenServerMarkup(
                await renderToString(appOf({ ...props, highlights: [a] })),
            );
            hydrate(appOf(props), other);
            expect(
                spies.warn.mock.calls.map(([message]) => message),
            ).toContainEqual(expect.stringContaining('Hydration'));
        });
    },
);

describe('Highlighter after hydration', () => {
    it('emits click with the offset and the caller highlights', async () => {
        const host = givenServerMarkup(
            await renderToString(appOf(partialOverlap)),
        );
        const clicks: PointDetail[] = [];
        hydrate(
            appOf(partialOverlap, (detail) => clicks.push(detail)),
            host,
        );
        const { el, position } = charPosition(
            host.firstElementChild as HTMLElement,
            10,
        );

        await userEvent.click(el, { position });

        expect(clicks.map((d) => d.offset)).toEqual([10]);
        expect(clicks[0]!.highlights[0]).toBe(a);
        expect(clicks[0]!.highlights[1]).toBe(b);
    });
});
