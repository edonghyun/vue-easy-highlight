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
import type { PointDetail } from '@overlapmark/core';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Highlighter } from '../src';

// hydrateRoot schedules its work; act() runs it, and every other render of
// this file, to the end before returning.
(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** `props` as a Highlighter element; `onClick` receives its clicks. */
function viewOf(
    props: ContractProps,
    onClick?: (detail: PointDetail) => void,
): ReactNode {
    const { decoration, ...rest } = propsOf(props);
    return (
        <Highlighter
            {...rest}
            renderDecoration={decoration}
            onClick={onClick}
        />
    );
}

/** Parses server `html` into a host at the end of the body, removed when the test finishes. */
function givenServerMarkup(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    onTestFinished(() => host.remove());
    return host;
}

/** Mounts `props` client-only in a new host; removal and unmounting are registered here. */
function givenClientMount(props: ContractProps): HTMLElement {
    const host = givenServerMarkup('');
    const root = createRoot(host);
    act(() => root.render(viewOf(props)));
    onTestFinished(() => act(() => root.unmount()));
    return host;
}

/** The sorted attribute names of every element under `host`, in document order. */
function attributeNamesOf(host: HTMLElement): string[][] {
    return [...host.querySelectorAll('*')].map((el) =>
        el.getAttributeNames().sort(),
    );
}

/**
 * Hydrates `node` on `host` to the end; unmounting is registered here.
 * `onRecoverableError` receives the errors React recovers from, a mismatch
 * among them.
 */
async function hydrate(
    host: HTMLElement,
    node: ReactNode,
    onRecoverableError: (error: unknown) => void = () => {},
): Promise<void> {
    const root = await act(async () =>
        hydrateRoot(host, node, { onRecoverableError }),
    );
    onTestFinished(() => act(() => root.unmount()));
}

/** Spies on the console channels React reports hydration problems on. */
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
            decoration: (segment) =>
                `[${segment.highlights.map((h) => h.id).join('+')}]`,
        };

        it('renders on the server the tree of the DOM contract', () => {
            const html = renderToString(viewOf(props));

            const host = givenServerMarkup(html);

            expect(
                serializeRoot(host.firstElementChild as HTMLElement),
            ).toEqual(expectedTree(props));
        });

        // serializeRoot reads style through the CSSOM, so an empty `class`
        // or `style` attribute only shows in the attribute names.
        it('renders on the server the attributes a client mount renders on each element', () => {
            const server = givenServerMarkup(renderToString(viewOf(props)));

            const client = givenClientMount(props);

            expect(attributeNamesOf(server)).toEqual(attributeNamesOf(client));
            expect(
                serializeRoot(server.firstElementChild as HTMLElement),
            ).toEqual(serializeRoot(client.firstElementChild as HTMLElement));
        });

        it('hydrates the server markup without a mismatch', async () => {
            const host = givenServerMarkup(renderToString(viewOf(props)));
            const spies = givenConsoleSpies();
            const recovered: unknown[] = [];

            await hydrate(host, viewOf(props), (error) =>
                recovered.push(error),
            );

            expect(recovered).toEqual([]);
            expect(spies.warn).not.toHaveBeenCalled();
            expect(spies.error).not.toHaveBeenCalled();
            // Live positive control: markup of other highlights is a mismatch.
            const other = givenServerMarkup(
                renderToString(viewOf({ ...props, highlights: [a] })),
            );
            await hydrate(other, viewOf(props), (error) =>
                recovered.push(error),
            );
            expect(String(recovered[0])).toContain('Hydration failed');
        });
    },
);

describe('Highlighter after hydration', () => {
    it('calls onClick with the offset and the caller highlights', async () => {
        const host = givenServerMarkup(renderToString(viewOf(partialOverlap)));
        const clicks: PointDetail[] = [];
        await hydrate(
            host,
            viewOf(partialOverlap, (detail) => clicks.push(detail)),
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
