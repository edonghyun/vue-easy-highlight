import { expect, test } from '@playwright/test';
import {
    charCentre,
    fixtures,
    givenHarness,
    logEntries,
    selectedTextInRoot,
} from './helpers.ts';

// Offset 15 of the overlaps fixture is covered by `a` and `b`. These specs
// run on the mobile profiles only (the touch screen needs `hasTouch`).
test.describe('Tapping a highlight', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, 'touch needs a mobile profile');
    });

    test('reports click with the covering highlights @core', async ({
        page,
    }) => {
        await givenHarness(page);
        const { x, y } = await charCentre(page, 15);

        await page.touchscreen.tap(x, y);

        await expect
            .poll(() => logEntries(page, 'click'))
            .toEqual([{ offset: 15, ids: ['a', 'b'] }]);
    });

    test('reports no hover', async ({ page }) => {
        await givenHarness(page);
        const { x, y } = await charCentre(page, 15);

        await page.touchscreen.tap(x, y);

        // The tap's own click is the live control for the missing hover.
        await expect
            .poll(() => logEntries(page))
            .toEqual([{ event: 'click', offset: 15, ids: ['a', 'b'] }]);
    });
});

// Only Chromium turns a long press into a native selection under automation:
// `Input.synthesizeTapGesture` with a duration is a real touch press-and-hold,
// and the browser selects the word under it. WebKit's `page.touchscreen`
// can only tap, so no long press is tested there. Playwright's Chromium on
// Linux CI runners does not turn an emulated long press into a selection (nor
// opens a context menu), so CI runs this test in a macOS leg.
test.describe('Long-pressing text', () => {
    test('reports select once the selection settles', async ({
        page,
        isMobile,
        browserName,
    }) => {
        test.skip(
            !isMobile || browserName !== 'chromium',
            'only Chromium selects text on a long press under automation',
        );
        test.skip(
            process.platform === 'linux',
            "Playwright's Chromium on Linux does not turn an emulated long press into a selection",
        );
        await givenHarness(page);
        const { x, y } = await charCentre(page, 15);
        const cdp = await page.context().newCDPSession(page);

        await cdp.send('Input.synthesizeTapGesture', {
            x,
            y,
            duration: 1000,
            gestureSourceType: 'touch',
        });

        await expect.poll(() => logEntries(page, 'select')).toHaveLength(1);
        const record = (await logEntries(page, 'select'))[0]!;
        const selected = await selectedTextInRoot(page);
        expect(selected).not.toBe('');
        expect(record).toMatchObject({ text: selected });
        expect(
            fixtures.overlaps.text.slice(
                record.start as number,
                record.end as number,
            ),
        ).toBe(selected);
    });
});
