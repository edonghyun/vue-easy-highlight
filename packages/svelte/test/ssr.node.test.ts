// Server rendering on a real server (D8): the browser SSR test renders in
// Node too, but inside a browser test run; only this one shows, with no
// `window` or `document` defined, that rendering the component, its
// decoration snippet included, never touches the DOM.
import { TEXT, partialOverlap } from '@overlapmark/adapter-contract/fixtures';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ServerView from './ServerView.svelte';

/** Server markup of `partialOverlap` with a decoration naming each segment's ids. */
function renderOnServer(): string {
    return render(ServerView, {
        props: {
            props: { text: TEXT, highlights: partialOverlap.highlights },
            decorated: true,
        },
    }).body;
}

/** The text of `html` with comments, tags and decorations removed. */
function textOf(html: string): string {
    return html
        .replace(/<!--.*?-->/g, '')
        .replace(/<span data-om-skip[^>]*>.*?<\/span>/g, '')
        .replace(/<[^>]+>/g, '');
}

describe('Highlighter rendered on a server without a DOM', () => {
    it('renders the text once, in its segments', () => {
        expect(typeof window).toBe('undefined');
        expect(typeof document).toBe('undefined');

        const html = renderOnServer();

        expect(textOf(html)).toBe(TEXT);
    });

    it('renders a mark per highlight layer and a decoration per highlighted segment', () => {
        const html = renderOnServer().replace(/<!--.*?-->/g, '');

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
                    `<span data-om-skip="" aria-hidden="true">${text}</span>`,
            ),
        );
    });
});
