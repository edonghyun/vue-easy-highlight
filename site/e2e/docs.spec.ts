import { expect, test } from '@playwright/test';
import { EVENTS, OPTIONS } from '../src/api-data';
import { QUICK_STARTS } from '../src/quick-starts';

const SECTIONS = [
    'usage',
    'highlight',
    'create-highlighter',
    'options',
    'events',
    'overlap-modes',
    'styling',
    'accessibility',
    'ssr',
    'shadow-dom',
    'limitations',
    'migrating',
];

test.beforeEach(async ({ page }) => {
    await page.goto('./docs/');
});

test('every TOC link targets a section on the page', async ({ page }) => {
    const hrefs = await page.$$eval('#toc a', (as) =>
        as.map((a) => a.getAttribute('href')),
    );
    expect(hrefs).toEqual(SECTIONS.map((id) => `#${id}`));
    for (const id of SECTIONS)
        await expect(page.locator(`#${id}`)).toHaveCount(1);
});

test('tables list every option and event', async ({ page }) => {
    await expect(page.locator('#options tbody tr')).toHaveCount(
        Object.keys(OPTIONS).length,
    );
    await expect(page.locator('#events tbody tr')).toHaveCount(
        Object.keys(EVENTS).length,
    );
});

test('the overlap examples render each mode', async ({ page }) => {
    for (const mode of ['multiply', 'darken', 'none']) {
        const root = page.locator(`#ex-modes [data-mode="${mode}"] .om-root`);
        await expect(root).toHaveAttribute('data-om-overlap', mode);
        expect(await root.locator('.om-hl').count()).toBeGreaterThan(0);
    }
});

test('clicking in the events example logs it', async ({ page }) => {
    const log = page.locator('#ex-events-log li');
    await expect(log).toHaveCount(0);
    await page.locator('#ex-events [data-om-depth]').first().click();
    await expect(log.first()).toHaveText(/^click/);
});

test('the TOC marks the section in view', async ({ page }) => {
    await page.locator('#events').scrollIntoViewIfNeeded();
    await page.evaluate(() =>
        document.getElementById('events')!.scrollIntoView({ block: 'start' }),
    );
    await expect(page.locator('#toc a[href="#events"]')).toHaveAttribute(
        'aria-current',
        'true',
    );
    await expect(page.locator('#toc a[aria-current="true"]')).toHaveCount(1);
});

test('the TOC collapses at 390px without horizontal scroll', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#toc details')).not.toHaveAttribute(
        'open',
        /.*/,
    );
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
});

test('quick-start tabs show the README code', async ({ page }) => {
    await page.locator('#usage [role="tab"]', { hasText: 'Svelte' }).click();
    expect(await page.locator('#usage pre').last().textContent()).toBe(
        QUICK_STARTS.Svelte.code,
    );
});

test('the events log is not a live region', async ({ page }) => {
    await expect(page.locator('#ex-events-log')).toHaveCount(1);
    await expect(page.locator('#ex-events-log')).not.toHaveAttribute(
        'aria-live',
        /.*/,
    );
});
