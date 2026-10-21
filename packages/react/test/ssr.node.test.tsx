// Server rendering on a real server (D8): the browser SSR test runs where
// `window` and `document` exist, so only this one shows that rendering the
// component, renderDecoration included, never touches the DOM.
import { TEXT, partialOverlap } from '@overlapmark/adapter-contract/fixtures';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { Highlighter } from '../src';

/** Server markup of `partialOverlap` with a decoration naming each segment's ids. */
function renderOnServer(): string {
    return renderToString(
        <Highlighter
            text={TEXT}
            highlights={partialOverlap.highlights}
            renderDecoration={(segment) =>
                `[${segment.highlights.map((h) => h.id).join('+')}]`
            }
        />,
    );
}

/** The text of `html` with tags and decorations removed. */
function textOf(html: string): string {
    return html
        .replace(/<span data-om-skip[^>]*>.*?<\/span>/g, '')
        .replace(/<!-- -->/g, '')
        .replace(/<[^>]+>/g, '');
}

/** Spies on `console.error`, where React reports problems with a render. */
function givenConsoleErrorSpy() {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => error.mockRestore());
    return error;
}

/** Runs of the warning control so far; see its use. */
let controlRuns = 0;

describe('Highlighter rendered on a server without a DOM', () => {
    it('renders the text once, in its segments', () => {
        expect(typeof window).toBe('undefined');
        expect(typeof document).toBe('undefined');

        const html = renderOnServer();

        expect(textOf(html)).toBe(TEXT);
    });

    it('renders a mark per highlight layer and a decoration per highlighted segment', () => {
        const html = renderOnServer();

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

    it('renders without a React warning', () => {
        const error = givenConsoleErrorSpy();

        renderOnServer();

        expect(error).not.toHaveBeenCalled();
        // Live positive control: a prop React does not know warns. React
        // warns once per prop name, so each run uses a new one.
        controlRuns += 1;
        const unknownProp = { [`omControl${controlRuns}`]: 'x' };
        renderToString(<span {...unknownProp} />);
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('React does not recognize'),
            `omControl${controlRuns}`,
            `omcontrol${controlRuns}`,
        );
    });
});
