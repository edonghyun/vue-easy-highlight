import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    applyHighlights,
    clickAt,
    dragSelect,
    fixtures,
    givenHarness,
    logEntries,
    rootOf,
} from './helpers.ts';

const { text, highlights } = fixtures.overlaps;
const [a] = highlights;

// The harness mounts the component inside an open shadow root on #host, or in
// the document of an iframe, with `embed`; the log stays in the page.
const embeddings = [
    {
        embed: 'shadow',
        where: 'inside a shadow root',
        rootIn: (page: Page): Locator => rootOf(page),
    },
    {
        embed: 'iframe',
        where: 'inside an iframe',
        rootIn: (page: Page): Locator =>
            page.frameLocator('#frame').locator('.om-root'),
    },
];

/** The `data-om-start` of the focused element of the tree `root` is in. */
function focusedStart(root: Locator): Promise<string | null> {
    return root.evaluate(
        (el) =>
            (
                el.getRootNode() as unknown as DocumentOrShadowRoot
            ).activeElement?.getAttribute('data-om-start') ?? null,
    );
}

/**
 * The selected text, read from the selection of `root`'s window as seen from
 * the shadow root `root` may be in (its composed range).
 */
function selectedText(root: Locator): Promise<string> {
    return root.evaluate((el) => {
        const selection = el.ownerDocument.defaultView!.getSelection()!;
        const tree = el.getRootNode();
        const [r] =
            tree instanceof ShadowRoot
                ? selection.getComposedRanges({ shadowRoots: [tree] })
                : [selection.getRangeAt(0)];
        const range = el.ownerDocument.createRange();
        range.setStart(r.startContainer, r.startOffset);
        range.setEnd(r.endContainer, r.endOffset);
        return range.toString();
    });
}

for (const { embed, where, rootIn } of embeddings) {
    test.describe(`A highlighter ${where}`, () => {
        test('reports every highlight covering a clicked point', async ({
            page,
        }) => {
            await givenHarness(page, { embed });
            const root = rootIn(page);

            await clickAt(page, 5, root);
            await clickAt(page, 15, root);
            await clickAt(page, 20, root);

            await expect
                .poll(() => logEntries(page, 'click'))
                .toEqual([
                    { offset: 5, ids: ['a'] },
                    { offset: 15, ids: ['a', 'b'] },
                    { offset: 20, ids: ['a', 'b', 'c'] },
                ]);
        });

        // 12 is where `b` starts: in Chromium a press on the first character
        // of a focusable highlight only starts a selection when core lifts
        // its tabindex, which needs the press's target inside the root.
        test('reports the exact range of a drag that starts on the first character of a highlight', async ({
            page,
        }) => {
            await givenHarness(page, { embed });

            await dragSelect(page, 12, 30, rootIn(page));

            await expect
                .poll(async () => (await logEntries(page, 'select')).at(-1))
                .toEqual({
                    start: 12,
                    end: 30,
                    text: text.slice(12, 30),
                    ids: ['a', 'b', 'c'],
                });
        });

        test('keeps the user selection across an update', async ({ page }) => {
            await givenHarness(page, { embed });
            const root = rootIn(page);
            await dragSelect(page, 41, 50, root);
            expect(await selectedText(root)).toBe(text.slice(41, 50));

            await applyHighlights(page, [a, { id: 'd', start: 44, end: 48 }]);

            await expect(root.locator('[data-om-ids="d"]')).toHaveCount(1);
            expect(await selectedText(root)).toBe(text.slice(41, 50));
        });

        test('keeps keyboard focus on the highlight at the same start across an update', async ({
            page,
        }) => {
            await givenHarness(page, { embed });
            const root = rootIn(page);
            const first = root.locator('[data-om-start="0"]');
            const background = (): Promise<string> =>
                first.evaluate((el) => getComputedStyle(el).backgroundColor);
            const before = await background();
            await first.focus();
            expect(await focusedStart(root)).toBe('0');

            await applyHighlights(page, [
                { ...a, color: 'rgb(144, 202, 249)' },
                ...highlights.slice(1),
            ]);

            await expect.poll(background).not.toBe(before);
            expect(await focusedStart(root)).toBe('0');
        });
    });
}
