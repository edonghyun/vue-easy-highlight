import { expect, test } from '@playwright/test';
import {
    expectHighlightsOnTheirCharacters,
    expectLuminanceDecreasing,
    givenHarness,
    lineCount,
    rootOf,
    segmentAt,
} from './helpers.ts';

// In the overlaps fixture, offsets 5, 15 and 20 are covered by 1, 2 and 3
// highlights, and 45 by none.
test.describe('Overlapping highlights', () => {
    test('get darker with each highlight that covers a spot', async ({
        page,
    }) => {
        await givenHarness(page);

        await expectLuminanceDecreasing(page, [5, 15, 20]);
    });

    test('leave uncovered text unhighlighted', async ({ page }) => {
        await givenHarness(page);

        const covered = await segmentAt(page, 5);
        const uncovered = await segmentAt(page, 45);

        expect(covered.highlighted).toBe(true);
        expect(uncovered.highlighted).toBe(false);
    });
});

test.describe('Highlights on wrapped text', () => {
    test('stay on their characters when the text wraps', async ({ page }) => {
        await givenHarness(page, { fixture: 'wrap', width: '240' });
        expect(await lineCount(page)).toBeGreaterThan(1);

        await expectHighlightsOnTheirCharacters(page);
    });

    test('stay on their characters after the viewport is resized', async ({
        page,
    }) => {
        await givenHarness(page, { fixture: 'wrap' });
        const widthBefore = (await rootOf(page).boundingBox())!.width;
        expect(widthBefore).toBeGreaterThan(360);

        await page.setViewportSize({ width: 360, height: 800 });

        await expect
            .poll(async () => (await rootOf(page).boundingBox())!.width)
            .toBeLessThan(360);
        expect(await lineCount(page)).toBeGreaterThan(1);
        await expectHighlightsOnTheirCharacters(page);
    });
});

test.describe('The depth strategy', () => {
    test('marks each segment with its depth', async ({ page }) => {
        await givenHarness(page, { strategy: 'depth' });

        const depths = await Promise.all(
            [5, 15, 20].map(
                async (offset) => (await segmentAt(page, offset)).depth,
            ),
        );

        expect(depths).toEqual(['1', '2', '3']);
    });
});
