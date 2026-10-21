import { expect, test } from '@playwright/test';
import { dragSelect, rootOf } from './helpers.ts';

// The text the README quick start renders.
const readmeText = 'Overlapping highlights get darker where they overlap.';

test.describe('The README quick start', () => {
    test('renders the README text inside an om-root', async ({ page }) => {
        await page.goto('/');

        await expect(rootOf(page)).toHaveText(readmeText);
    });

    test('adds a highlight for a text the user drags across', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(rootOf(page)).toHaveText(readmeText);
        const overlapping = rootOf(page)
            .locator('.om-hl')
            .filter({ hasText: /^Overlapping$/ });
        await expect(overlapping).toHaveCount(0);

        await dragSelect(page, 0, 11);

        await expect(overlapping.first()).toBeVisible();
    });
});
