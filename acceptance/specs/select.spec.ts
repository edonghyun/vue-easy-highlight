import { expect, test, type Page } from '@playwright/test';
import {
    charBox,
    clickAt,
    dragSelect,
    fixtures,
    givenHarness,
    logEntries,
} from './helpers.ts';

const { text } = fixtures.overlaps;

/** The selection records the harness logged, polled until they settle on `expected`. */
async function expectSelects(page: Page, expected: object[]): Promise<void> {
    await expect.poll(() => logEntries(page, 'select')).toEqual(expected);
}

test.describe('Selecting text with the mouse', () => {
    test('reports the exact range of the dragged characters @core', async ({
        page,
    }) => {
        await givenHarness(page);

        await dragSelect(page, 12, 30);

        await expect
            .poll(async () => (await logEntries(page, 'select')).at(-1))
            .toEqual({
                start: 12,
                end: 30,
                text: text.slice(12, 30),
                ids: ['a', 'b', 'c'],
            });
    });

    test('reports exact code-unit offsets across Hangul and emoji', async ({
        page,
    }) => {
        const unicode = fixtures.unicode.text;
        const dragged = '🧪 은 겹친';
        const start = unicode.indexOf(dragged);
        const end = start + dragged.length;
        await givenHarness(page, { fixture: 'unicode' });

        await dragSelect(page, start, end);

        await expect
            .poll(async () => (await logEntries(page, 'select')).at(-1))
            .toMatchObject({ start, end, text: dragged });
    });

    test('counts collapsed whitespace and newlines in the raw text', async ({
        page,
    }) => {
        const whitespace = fixtures.whitespace.text;
        const dragged = 'and a newline';
        const start = whitespace.indexOf(dragged);
        await givenHarness(page, { fixture: 'whitespace' });

        await dragSelect(page, start, start + dragged.length);

        await expect
            .poll(async () => (await logEntries(page, 'select')).at(-1))
            .toMatchObject({
                start,
                end: start + dragged.length,
                text: dragged,
            });
    });

    test('reports only the part inside the root for a drag that starts before it', async ({
        page,
    }) => {
        await givenHarness(page);
        const before = (await page.locator('#before').boundingBox())!;
        const to = await charBox(page, 10);

        await page.mouse.move(before.x + 2, before.y + before.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width * 0.75, to.y + to.height / 2, {
            steps: 5,
        });
        await page.mouse.up();

        await expect
            .poll(async () => (await logEntries(page, 'select')).at(-1))
            .toMatchObject({ start: 0, end: 11, text: text.slice(0, 11) });
    });
});

test.describe('Selecting text with the keyboard', () => {
    // Chromium and WebKit extend a selection with Shift+Arrow but do not
    // start one from a caret in static text, so the run starts from a
    // one-character selection, as a user's would.
    test('reports one select when Shift is released after Shift+Arrow @core', async ({
        page,
    }) => {
        await givenHarness(page);
        await dragSelect(page, 0, 1);
        const dragged = {
            start: 0,
            end: 1,
            text: text.slice(0, 1),
            ids: ['a'],
        };
        await expectSelects(page, [dragged]);

        await page.keyboard.down('Shift');
        for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
        await page.keyboard.up('Shift');

        const extended = {
            start: 0,
            end: 11,
            text: text.slice(0, 11),
            ids: ['a'],
        };
        await expectSelects(page, [dragged, extended]);
        // A later event proves no further select was still on its way.
        await clickAt(page, 45);
        await expect(page.locator('#log li[data-event="click"]')).toHaveCount(
            1,
        );
        expect(await logEntries(page, 'select')).toEqual([dragged, extended]);
    });

    test('reports the whole text for select all', async ({ page }) => {
        await givenHarness(page);
        await clickAt(page, 45);

        await page.keyboard.press('ControlOrMeta+a');

        await expect
            .poll(async () => (await logEntries(page, 'select')).at(-1))
            .toMatchObject({ start: 0, end: text.length, text });
    });
});

test.describe('A selection shorter than minSelectionLength', () => {
    test('reports no select', async ({ page }) => {
        await givenHarness(page, { minSelectionLength: '3' });

        await dragSelect(page, 0, 2);
        // Pressing inside a selection would drag it, so let it go first.
        await clickAt(page, 45);
        await dragSelect(page, 0, 3);

        // The second drag's select proves the first one had been confirmed.
        await expectSelects(page, [
            { start: 0, end: 3, text: text.slice(0, 3), ids: ['a'] },
        ]);
    });
});
