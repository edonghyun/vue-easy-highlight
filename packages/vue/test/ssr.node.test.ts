// Server rendering on a real server (D8): the browser SSR test runs where
// `window` and `document` exist, so only this one shows that rendering the
// component, its decoration slot included, never touches the DOM.
import { TEXT, partialOverlap } from '@overlapmark/adapter-contract/fixtures';
import type { Segment } from '@overlapmark/core';
import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Highlighter } from '../src';

/** Server markup of `partialOverlap` with a decoration naming each segment's ids. */
function renderOnServer(): Promise<string> {
    const app = createSSRApp({
        render: () =>
            h(
                Highlighter,
                { text: TEXT, highlights: partialOverlap.highlights },
                {
                    decoration: ({ segment }: { segment: Segment }) =>
                        `[${segment.highlights.map((h) => h.id).join('+')}]`,
                },
            ),
    });
    return renderToString(app);
}

/** The text of `html` with tags and decorations removed. */
function textOf(html: string): string {
    return html
        .replace(/<span data-om-skip[^>]*>.*?<\/span>/g, '')
        .replace(/<[^>]+>/g, '');
}

describe('Highlighter rendered on a server without a DOM', () => {
    it('renders the text once, in its segments', async () => {
        expect(typeof window).toBe('undefined');
        expect(typeof document).toBe('undefined');

        const html = await renderOnServer();

        expect(textOf(html)).toBe(TEXT);
    });

    it('renders a mark per highlight layer and a decoration per highlighted segment', async () => {
        const html = await renderOnServer();

        // [0,6) a · [6,15) a+b (two layers) · [15,21) b · [21,30) plain
        expect(html.match(/<mark /g)).toHaveLength(4);
        expect(html.match(/data-ids="[^"]*"/g)).toEqual([
            'data-ids="a"',
            'data-ids="a,b"',
            'data-ids="b"',
        ]);
        expect(html.match(/<span data-om-skip[^>]*>(.*?)<\/span>/g)).toEqual(
            ['[a]', '[a+b]', '[b]'].map(
                (text) =>
                    `<span data-om-skip aria-hidden="true">${text}</span>`,
            ),
        );
    });
});
