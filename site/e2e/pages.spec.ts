import { expect, test } from '@playwright/test';

const PAGES = ['./', './docs/'];

for (const path of PAGES) {
    test(`${path} loads under /overlapmark/ without console errors`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('pageerror', (e) => errors.push(e.message));
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await page.waitForLoadState('networkidle');
        expect(errors).toEqual([]);
    });

    test(`every same-origin link and asset on ${path} resolves`, async ({
        page,
        request,
    }) => {
        await page.goto(path);
        const urls = await page.evaluate(() => {
            const out = new Set<string>();
            const attr = (sel: string, name: string) =>
                document.querySelectorAll(sel).forEach((el) => {
                    const value = el.getAttribute(name);
                    if (!value) return;
                    const url = new URL(value, location.href);
                    url.hash = '';
                    if (url.origin === location.origin) out.add(url.href);
                });
            attr('a[href]', 'href');
            attr('link[href]', 'href');
            attr('script[src]', 'src');
            attr('img[src]', 'src');
            return [...out];
        });
        expect(urls.length).toBeGreaterThan(0);
        const statuses = await Promise.all(
            urls.map(async (url) => [url, (await request.get(url)).status()]),
        );
        expect(statuses.filter(([, status]) => status !== 200)).toEqual([]);
    });
}
