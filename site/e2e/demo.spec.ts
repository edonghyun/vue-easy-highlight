import { expect, test, type Page } from '@playwright/test';
import { QUICK_STARTS } from '../src/quick-starts';

/** Distinct highlight ids rendered inside `selector`. */
const highlightCount = (page: Page, selector: string) =>
    page.$$eval(
        `${selector} [data-om-id]`,
        (els) =>
            new Set(els.map((el) => (el as HTMLElement).dataset.omId)).size,
    );

const maxDepth = (page: Page, selector: string) =>
    page.$$eval(`${selector} [data-om-depth]`, (els) =>
        Math.max(
            0,
            ...els.map((el) => Number((el as HTMLElement).dataset.omDepth)),
        ),
    );

/** Viewport rect of `phrase` inside the text of `selector`. */
const phraseRect = (page: Page, selector: string, phrase: string) =>
    page.evaluate(
        ([selector, phrase]) => {
            const root = document.querySelector(selector!)!;
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (n) =>
                        n.parentElement?.closest('[data-om-skip]')
                            ? NodeFilter.FILTER_REJECT
                            : NodeFilter.FILTER_ACCEPT,
                },
            );
            const nodes: Text[] = [];
            let text = '';
            while (walker.nextNode()) {
                nodes.push(walker.currentNode as Text);
                text += (walker.currentNode as Text).data;
            }
            const at = (offset: number): [Text, number] => {
                for (const node of nodes) {
                    if (offset <= node.data.length) return [node, offset];
                    offset -= node.data.length;
                }
                throw new Error('offset out of range');
            };
            const start = text.indexOf(phrase!);
            if (start < 0) throw new Error(`"${phrase}" not found`);
            const range = document.createRange();
            range.setStart(...at(start));
            range.setEnd(...at(start + phrase!.length));
            const r = range.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        },
        [selector, phrase],
    );

test.beforeEach(async ({ page }) => {
    await page.goto('./');
});

test('Add a highlight adds one highlight and updates the status', async ({
    page,
}) => {
    const before = await highlightCount(page, '#hero');
    await page.click('#add');
    expect(await highlightCount(page, '#hero')).toBe(before + 1);
    await expect(page.locator('#hero-status')).toContainText(
        `${before + 1} highlights`,
    );
    expect(before).toBe(3);
});

test('selecting words in the hero adds a highlight', async ({ page }) => {
    const r = await phraseRect(page, '#hero', 'the page should');
    const y = r.y + r.height / 2;
    await page.mouse.move(r.x + 1, y);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width - 1, y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => highlightCount(page, '#hero')).toBe(4);
    await expect(page.locator('#hero-status')).toContainText('4 highlights');
});

test('Reset clears the hero', async ({ page }) => {
    expect(await page.locator('#hero .om-hl').count()).toBeGreaterThan(0);
    await page.click('#reset');
    await expect(page.locator('#hero .om-hl')).toHaveCount(0);
});

test('the layers slider sets the deepest depth', async ({ page }) => {
    for (const n of [1, 6, 3]) {
        await page.locator('#layers').fill(String(n));
        expect(await maxDepth(page, '#layers-stage')).toBe(n);
    }
});

test('clicking a stacked word lists every layer', async ({ page }) => {
    const deepest = await maxDepth(page, '#click-stage');
    expect(deepest).toBeGreaterThan(1);
    await page
        .locator(`#click-stage [data-om-depth="${deepest}"]`)
        .first()
        .click();
    await expect(page.locator('#click-out .chip')).toHaveCount(deepest);
});

test('Enter on a focused highlight lists its layers', async ({ page }) => {
    await expect(page.locator('#click-out .chip')).toHaveCount(0);
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(
            () => !!document.activeElement?.closest('#click-stage'),
        );
        if (inside) break;
    }
    await page.keyboard.press('Enter');
    expect(
        await page.locator('#click-out .chip').count(),
    ).toBeGreaterThanOrEqual(1);
});

test('style presets set the highlight class', async ({ page }) => {
    const marks = page.locator('#style-stage .om-hl');
    await page.locator('#style-presets button', { hasText: 'Marker' }).click();
    const total = await marks.count();
    expect(total).toBeGreaterThan(0);
    await expect(
        page.locator('#style-stage .om-hl.om-style-marker'),
    ).toHaveCount(total);
    await page.locator('#style-presets button', { hasText: 'Fill' }).click();
    await expect(
        page.locator('#style-stage .om-hl.om-style-marker'),
    ).toHaveCount(0);
});

test('framework tabs switch the code', async ({ page }) => {
    await page
        .locator('#frameworks [role="tab"]', { hasText: 'React' })
        .click();
    expect(await page.locator('#frameworks pre').textContent()).toBe(
        QUICK_STARTS.React.code,
    );
});

test('docs links point at ./docs/', async ({ page }) => {
    const hrefs = await page.$$eval('a', (as) =>
        as
            .filter((a) => /docs/i.test(a.textContent ?? ''))
            .map((a) => (a as HTMLAnchorElement).href),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) expect(href).toMatch(/\/overlapmark\/docs\/$/);
});

test('no horizontal scroll at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
});

test('stages stay light under a dark OS theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(
        await page
            .locator('#hero')
            .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(255, 255, 255)');
});

test('hero highlights are not Tab stops', async ({ page }) => {
    expect(
        await page.locator('#click-stage [tabindex="0"]').count(),
    ).toBeGreaterThan(0);
    await expect(page.locator('#hero [tabindex]')).toHaveCount(0);
});

test('a second copy click keeps the install command', async ({
    page,
    context,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const chip = page.locator('#install');
    await chip.click();
    await expect(chip).toHaveText('Copied');
    await chip.click();
    await expect(chip).toHaveText('npm i @overlapmark/dom');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        'npm i @overlapmark/dom',
    );
});
