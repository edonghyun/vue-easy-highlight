// Server rendering and hydration (D8): the markup svelte/server's `render`
// produces is the DOM contract's tree, the client takes it over without a
// mismatch, and the hydrated component handles events. The markup comes from
// Node through the renderOnServer command (see server-render.ts).
import {
    a,
    b,
    charPosition,
    expectedTree,
    partialOverlap,
    serializeRoot,
} from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type { PointDetail } from '@overlapmark/core';
import { flushSync, hydrate, mount, unmount } from 'svelte';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import ServerView from './ServerView.svelte';
import { decorationOf } from './server-view';
import type { ServerViewProps } from './server-view';

/** Parses server `html` into a host at the end of the body, removed when the test finishes. */
function givenServerMarkup(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    onTestFinished(() => host.remove());
    return host;
}

/** Mounts `view` client-only in a new host; removal and unmounting are registered here. */
function givenClientMount(view: ServerViewProps): HTMLElement {
    const host = givenServerMarkup('');
    const instance = mount(ServerView, { target: host, props: view });
    flushSync();
    onTestFinished(() => unmount(instance));
    return host;
}

/** Hydrates `view` on `host`; unmounting is registered here. */
function hydrateOn(
    host: HTMLElement,
    view: ServerViewProps & { onclick?: (detail: PointDetail) => void },
): void {
    const instance = hydrate(ServerView, { target: host, props: view });
    flushSync();
    onTestFinished(() => unmount(instance));
}

/** The sorted attribute names of every element under `host`, in document order. */
function attributeNamesOf(host: HTMLElement): string[][] {
    return [...host.querySelectorAll('*')].map((el) =>
        el.getAttributeNames().sort(),
    );
}

/** Spies on the console channels Svelte reports hydration mismatches on. */
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
const cases: {
    label: string;
    options: Partial<ServerViewProps['props']>;
}[] = [
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
        const view: ServerViewProps = {
            props: {
                text: partialOverlap.text,
                highlights: partialOverlap.highlights,
                ...options,
            },
            decorated: true,
        };

        it('renders on the server the tree of the DOM contract', async () => {
            const html = await commands.renderOnServer(view);

            const host = givenServerMarkup(html);

            expect(
                serializeRoot(host.firstElementChild as HTMLElement),
            ).toEqual(
                expectedTree({ ...view.props, decoration: decorationOf }),
            );
        });

        // serializeRoot reads style through the CSSOM and drops empty class
        // tokens, so an empty `class` or `style` attribute only shows in the
        // attribute names.
        it('renders on the server the attributes a client mount renders on each element', async () => {
            const server = givenServerMarkup(
                await commands.renderOnServer(view),
            );

            const client = givenClientMount(view);

            expect(attributeNamesOf(server)).toEqual(attributeNamesOf(client));
            expect(
                serializeRoot(server.firstElementChild as HTMLElement),
            ).toEqual(serializeRoot(client.firstElementChild as HTMLElement));
        });

        // Svelte warns only when the markup lacks the hydration markers it
        // expects, not when content differs: the parity test above is what
        // keeps the content equal.
        it('hydrates the server markup without a mismatch warning', async () => {
            const html = await commands.renderOnServer(view);
            const host = givenServerMarkup(html);
            const spies = givenConsoleSpies();

            hydrateOn(host, view);

            expect(spies.warn).not.toHaveBeenCalled();
            expect(spies.error).not.toHaveBeenCalled();
            // Live positive control: the same markup cut before its closing
            // hydration marker does warn.
            const cut = givenServerMarkup(html.replace(/<!--\]-->$/, ''));
            hydrateOn(cut, view);
            expect(
                spies.warn.mock.calls.map(([message]) => String(message)),
            ).toContainEqual(expect.stringContaining('hydration_mismatch'));
        });

        // A failed hydration clears the host and mounts anew, silently when
        // the markup has no hydration markers at all.
        it('takes over the server elements, which keep the tree of the DOM contract', async () => {
            const host = givenServerMarkup(await commands.renderOnServer(view));
            const serverElements = [...host.querySelectorAll('*')];

            hydrateOn(host, view);

            const hydrated = [...host.querySelectorAll('*')];
            expect(hydrated).toHaveLength(serverElements.length);
            for (const [i, el] of hydrated.entries())
                expect(el).toBe(serverElements[i]);
            expect(
                serializeRoot(host.firstElementChild as HTMLElement),
            ).toEqual(
                expectedTree({ ...view.props, decoration: decorationOf }),
            );
        });
    },
);

describe('Highlighter after hydration', () => {
    it('calls onclick with the offset and the caller highlights', async () => {
        const view: ServerViewProps = {
            props: { text: partialOverlap.text, highlights: [a, b] },
        };
        const host = givenServerMarkup(await commands.renderOnServer(view));
        const clicks: PointDetail[] = [];
        hydrateOn(host, { ...view, onclick: (detail) => clicks.push(detail) });
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
