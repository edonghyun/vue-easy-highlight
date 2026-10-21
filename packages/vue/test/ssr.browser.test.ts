// Server rendering and hydration (D8): the markup renderToString produces is
// the DOM contract's tree, the client takes it over without a mismatch, and
// the hydrated component handles events.
import {
    TEXT,
    a,
    b,
    charPosition,
    expectedTree,
    partialOverlap,
    serializeRoot,
} from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type { PointDetail, Segment, Strategy } from '@overlapmark/core';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSSRApp, h } from 'vue';
import type { App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Highlighter } from '../src';

const decoration = (segment: Segment): string =>
    `[${segment.highlights.map((h) => h.id).join('+')}]`;

/** `props` as an SSR app; `onClick` receives the hydrated instance's clicks. */
function appOf(
    props: ContractProps,
    onClick: (detail: PointDetail) => void = () => {},
): App {
    return createSSRApp({
        render: () =>
            h(
                Highlighter,
                {
                    text: props.text,
                    highlights: props.highlights,
                    strategy: props.strategy,
                    onClick,
                },
                props.decoration && {
                    decoration: ({ segment }: { segment: Segment }) =>
                        props.decoration!(segment),
                },
            ),
    });
}

/** Parses server `html` into a host at the end of the body, removed when the test finishes. */
function givenServerMarkup(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    onTestFinished(() => host.remove());
    return host;
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

const cases: { strategy: Strategy }[] = [
    { strategy: 'layers' },
    { strategy: 'depth' },
];

describe.each(cases)(
    'Highlighter SSR with the $strategy strategy and decorations',
    ({ strategy }) => {
        const props: ContractProps = {
            ...partialOverlap,
            strategy,
            decoration,
        };

        it('renders on the server the tree of the DOM contract', async () => {
            const html = await renderToString(appOf(props));

            const host = givenServerMarkup(html);

            expect(
                serializeRoot(host.firstElementChild as HTMLElement),
            ).toEqual(expectedTree(props));
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
        expect(clicks[0].highlights[0]).toBe(a);
        expect(clicks[0].highlights[1]).toBe(b);
        expect(host.textContent).toBe(TEXT);
    });
});
