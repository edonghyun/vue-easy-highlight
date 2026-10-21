import { expect, test, type Page } from '@playwright/test';
import { fixtures, givenHarness, rootOf } from './helpers.ts';

// Runs on the `ssr` variant only (see playwright.config.ts): harness.html is
// the server render of the default query, hydrated by the client.
const { text } = fixtures.overlaps;

/** The page's `body`, which carries `data-hydration-issue` once a hook fired. */
function bodyOf(page: Page) {
    return page.locator('body');
}

test.describe('A server-rendered page', () => {
    test('contains the highlighted markup before any script runs', async ({
        browser,
        baseURL,
    }) => {
        const context = await browser.newContext({
            baseURL,
            javaScriptEnabled: false,
        });
        const page = await context.newPage();

        await page.goto('/harness.html');

        await expect(rootOf(page)).toHaveText(text);
        await expect(rootOf(page).locator('[data-ids="a,b,c"]')).toHaveText(
            text.slice(18, 26),
        );
        await context.close();
    });

    test('hydrates without a mismatch warning', async ({ page, context }) => {
        const mismatched = await context.newPage();

        await givenHarness(page);
        await givenHarness(mismatched, { mismatch: '1' });

        // The client rendering other text than the server is the live
        // control: the same hooks mark that page.
        await expect(bodyOf(mismatched)).toHaveAttribute(
            'data-hydration-issue',
            /./,
        );
        await expect(bodyOf(page)).not.toHaveAttribute('data-hydration-issue');
    });
});
