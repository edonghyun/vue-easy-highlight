import { expect, test, type Page } from '@playwright/test';
import {
    backgroundsAt,
    dragSelect,
    expectColorClose,
    fixtures,
    givenHarness,
    rootOf,
    type Rgb,
} from './helpers.ts';

// In the overlaps fixture, [18, 26) is covered by a, b and c, and offset 45
// by none.
const { text } = fixtures.overlaps;
const coveredThrice = text.slice(18, 26);

function highlightButton(page: Page, name: string) {
    return rootOf(page).getByRole('button', { name, exact: true });
}

/** The system `Mark` color as the page resolves it. */
function markColor(page: Page): Promise<Rgb> {
    return page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'Mark';
        document.body.append(probe);
        const channels = getComputedStyle(probe).color.match(/\d+/g)!;
        probe.remove();
        return channels.slice(0, 3).map(Number) as Rgb;
    });
}

test.describe('Assistive technology', () => {
    test('a focused highlight is announced as a button with its text and its highlight count @core', async ({
        page,
    }) => {
        await givenHarness(page);

        await highlightButton(page, coveredThrice).focus();

        const focused = page.locator(':focus');
        await expect(focused).toMatchAriaSnapshot(
            `- button "${coveredThrice}"`,
        );
        await expect(focused).toHaveAccessibleDescription('3 highlights');
    });

    test('copying text that includes a described highlight copies only the text', async ({
        page,
    }) => {
        await givenHarness(page, { decorate: '1' });
        await expect(
            highlightButton(page, coveredThrice),
        ).toHaveAccessibleDescription('3 highlights');
        await dragSelect(page, 0, text.length);

        await page.keyboard.press('ControlOrMeta+c');

        const pasted = page.locator('#highlights-json');
        await pasted.fill('');
        await pasted.press('ControlOrMeta+v');
        await expect(pasted).toHaveValue(text);
    });

    test('a highlight keeps a visible fill and an outline in forced colors', async ({
        page,
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await givenHarness(page);
        const mark = await markColor(page);

        const [covered, plain] = await backgroundsAt(page, [5, 45]);

        expectColorClose(covered, mark);
        expect(plain).not.toEqual(covered);
        await expect(highlightButton(page, coveredThrice)).toHaveCSS(
            'outline-style',
            'solid',
        );
    });
});
