import { expect, test } from '@playwright/test';
import {
    applyHighlights,
    dragSelect,
    fixtures,
    givenHarness,
    rootOf,
} from './helpers.ts';

const { text, highlights } = fixtures.overlaps;
const [a] = highlights;

test.describe('Applying new highlights', () => {
    test('shows them without a reload @core', async ({ page }) => {
        await givenHarness(page);
        const coveredByB = rootOf(page).locator('[data-om-ids~="b"]');
        await expect(coveredByB).not.toHaveCount(0);

        await applyHighlights(page, [a]);

        await expect(coveredByB).toHaveCount(0);
        await expect(rootOf(page).locator('[data-om-ids="a"]')).toHaveCount(1);
    });

    test('keeps the user selection', async ({ page }) => {
        await givenHarness(page);
        await dragSelect(page, 41, 50);
        const selected = (): Promise<string> =>
            page.evaluate(() => window.getSelection()!.toString());
        expect(await selected()).toBe(text.slice(41, 50));

        await applyHighlights(page, [a, { id: 'd', start: 44, end: 48 }]);

        await expect(rootOf(page).locator('[data-om-ids="d"]')).toHaveCount(1);
        expect(await selected()).toBe(text.slice(41, 50));
    });

    test('keeps keyboard focus on the highlight at the same start', async ({
        page,
    }) => {
        await givenHarness(page);
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        await expect(focused).toHaveAttribute('data-om-start', '0');
        const first = rootOf(page).locator('[data-om-start="0"]');
        const background = (): Promise<string> =>
            first.evaluate((el) => getComputedStyle(el).backgroundColor);
        const before = await background();

        await applyHighlights(page, [
            { ...a, color: 'rgb(144, 202, 249)' },
            ...highlights.slice(1),
        ]);

        expect(await background()).not.toBe(before);
        await expect(focused).toHaveAttribute('data-om-start', '0');
    });
});
