import { expect, test } from '@playwright/test';
import { charCentre, clickAt, givenHarness, logEntries } from './helpers.ts';

// In the overlaps fixture, offsets 5, 15 and 20 are covered by `a`, `a,b`
// and `a,b,c`, and 45 by none. `ids` come in highlight order.
test.describe('Clicking a highlight', () => {
    test('reports every highlight covering that point @core', async ({
        page,
    }) => {
        await givenHarness(page);

        await clickAt(page, 5);
        await clickAt(page, 15);
        await clickAt(page, 20);

        await expect
            .poll(() => logEntries(page, 'click'))
            .toEqual([
                { offset: 5, ids: ['a'] },
                { offset: 15, ids: ['a', 'b'] },
                { offset: 20, ids: ['a', 'b', 'c'] },
            ]);
    });

    test('reports no covering highlights for plain text', async ({ page }) => {
        await givenHarness(page);

        await clickAt(page, 45);
        await clickAt(page, 5);

        // The click on `a` is the live control for the empty `ids`.
        await expect
            .poll(() => logEntries(page, 'click'))
            .toEqual([
                { offset: 45, ids: [] },
                { offset: 5, ids: ['a'] },
            ]);
    });

    test('reports the right offset after the page scrolls', async ({
        page,
    }) => {
        // At 240px the wrapped text is shorter than the 200px scroller.
        await givenHarness(page, {
            fixture: 'wrap',
            width: '120',
            scroll: '1',
        });
        const scroller = page.locator('#scroller');

        await scroller.evaluate((el) => (el.scrollTop = 100));
        await expect
            .poll(() => scroller.evaluate((el) => el.scrollTop))
            .toBe(100);
        await clickAt(page, 80);

        await expect
            .poll(async () => (await logEntries(page, 'click')).at(-1))
            .toEqual({ offset: 80, ids: ['long'] });
    });
});

test.describe('Double-clicking a highlight', () => {
    test('reports dblclick with the covering highlights', async ({ page }) => {
        await givenHarness(page);
        const { x, y } = await charCentre(page, 20);

        await page.mouse.dblclick(x, y);

        await expect
            .poll(() => logEntries(page, 'dblclick'))
            .toEqual([{ offset: 20, ids: ['a', 'b', 'c'] }]);
    });
});

test.describe('Keyboard activation', () => {
    test('Enter and Space on a focused highlight report click @core', async ({
        page,
    }) => {
        await givenHarness(page);
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toHaveAttribute(
            'data-om-start',
            '0',
        );

        await page.keyboard.press('Enter');
        await page.keyboard.press(' ');

        await expect
            .poll(() => logEntries(page, 'click'))
            .toEqual([
                { offset: 0, ids: ['a'] },
                { offset: 0, ids: ['a'] },
            ]);
    });
});

test.describe('Hovering a highlight', () => {
    test('reports enter then leave with the pointer event', async ({
        page,
        isMobile,
    }) => {
        test.skip(isMobile, 'hover is desktop only');
        await givenHarness(page);
        const before = (await page.locator('#before').boundingBox())!;
        const { x, y } = await charCentre(page, 5);

        await page.mouse.move(x, y);
        await page.mouse.move(before.x + 2, before.y + before.height / 2);

        await expect
            .poll(() => logEntries(page, 'hover'))
            .toEqual([
                { type: 'enter', ids: ['a'], eventIsNull: false },
                { type: 'leave', ids: ['a'], eventIsNull: false },
            ]);
    });
});
