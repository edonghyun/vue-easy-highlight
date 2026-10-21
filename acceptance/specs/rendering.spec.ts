import { expect, test } from '@playwright/test';
import {
    backgroundsAt,
    expectColorClose,
    expectHighlightsOnTheirCharacters,
    expectLuminanceDecreasing,
    fixtures,
    givenHarness,
    lineCount,
    over,
    pixelAt,
    rgbOf,
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

// In the distinct and similar fixtures, offsets 5, 15, 25 and 40 are covered
// by 1, 2, 3 and 4 highlights. In distinct, the pale yellow `d` sits inside
// the saturated blue `c`.
const DEPTHS = [5, 15, 25, 40];
/** The fill alpha of a layer: the `--om-alpha` default. */
const ALPHA = 0.55;
const WHITE: [number, number, number] = [255, 255, 255];

test.describe('Overlap modes', () => {
    test('multiply gets darker with every highlight that covers a spot, whatever their colors', async ({
        page,
    }) => {
        await givenHarness(page, { fixture: 'distinct', overlap: 'multiply' });

        await expectLuminanceDecreasing(page, DEPTHS);
    });

    test('multiply is the default', async ({ page }) => {
        await givenHarness(page, { fixture: 'distinct' });

        await expect(rootOf(page)).toHaveAttribute(
            'data-om-overlap',
            'multiply',
        );
        await expectLuminanceDecreasing(page, DEPTHS);
    });

    test('darken gets darker for colors of similar lightness', async ({
        page,
    }) => {
        await givenHarness(page, { fixture: 'similar', overlap: 'darken' });

        await expectLuminanceDecreasing(page, DEPTHS);
    });

    test('none paints plain translucent layers', async ({ page }) => {
        const [a, b] = fixtures.similar.highlights.map((h) => rgbOf(h.color!));
        const expected = over(b!, ALPHA, over(a!, ALPHA, WHITE));
        await givenHarness(page, { fixture: 'similar', overlap: 'none' });

        const [none] = await backgroundsAt(page, [15]);

        expectColorClose(none, expected);
        // Live control: multiply paints the same spot differently.
        await givenHarness(page, { fixture: 'similar', overlap: 'multiply' });
        const [multiplied] = await backgroundsAt(page, [15]);
        expect(
            Math.max(...multiplied.map((v, i) => Math.abs(v - expected[i]!))),
        ).toBeGreaterThan(3);
    });

    test('multiply leaves the page background outside the root unchanged', async ({
        page,
    }) => {
        const tint = rgbOf('#e7f5ff');
        await givenHarness(page, { fixture: 'distinct', bg: '1' });
        const box = (await rootOf(page).boundingBox())!;

        const outside = await pixelAt(page, box.x - 6, box.y + box.height / 2);
        const [single] = await backgroundsAt(page, [5]);

        expectColorClose(outside, tint);
        // The root is an isolated group: the outermost layer is painted over
        // the tint the plain way, not multiplied with it.
        const a = rgbOf(fixtures.distinct.highlights[0]!.color!);
        expectColorClose(single, over(a, ALPHA, tint));
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
