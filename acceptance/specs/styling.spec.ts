import { expect, test } from '@playwright/test';
import {
    backgroundsAt,
    clickAt,
    fixtures,
    givenHarness,
    highlightClassesAt,
    rootOf,
    selectedTextInRoot,
} from './helpers.ts';

const { text } = fixtures.overlaps;

test.describe('Styling', () => {
    // Offset 5 is covered by `a` alone (depth 1). The shipped default colour
    // is a lavender, bluer than it is red.
    test('--om-default-color set on the root changes the highlight colour', async ({
        page,
    }) => {
        await givenHarness(page);
        const [[defaultRed, , defaultBlue]] = await backgroundsAt(page, [5]);
        expect(defaultRed).toBeLessThan(defaultBlue);

        await givenHarness(page, { css: 'default-color' });

        const [[red, , blue]] = await backgroundsAt(page, [5]);
        expect(red).toBeGreaterThan(blue);
    });

    test('a highlight className lands on its element', async ({ page }) => {
        await givenHarness(page, { className: '1' });

        expect(await highlightClassesAt(page, 5)).toContain('mine');
    });

    test('decorations show and stay out of copied text', async ({ page }) => {
        await givenHarness(page, { decorate: '1' });
        await expect(
            rootOf(page).locator('[data-om-skip]', { hasText: /^2$/ }).first(),
        ).toBeVisible();

        await clickAt(page, 45);
        await page.keyboard.press('ControlOrMeta+a');

        expect(await selectedTextInRoot(page)).toBe(text);
    });
});
