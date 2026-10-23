// Renders the README images into docs-assets/ from the built site
// (site/): one per overlap mode and a hero of the inspector.
// Run with `pnpm docs:images`. The pages are captured in the light theme at
// twice the pixel density. The mode images are white cards on a transparent
// page and the hero carries the page's own background, so both read on
// GitHub's light and dark themes; each is re-encoded as a palette PNG.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { preview } from 'vite';
import { toPalettePng } from './palette-png.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = join(root, 'site');
const out = join(root, 'docs-assets');

const MODES = ['multiply', 'darken', 'none'] as const;

execFileSync('pnpm', ['--filter', 'overlapmark-site', 'build'], {
    cwd: root,
    stdio: 'inherit',
});

const server = await preview({
    root: demo,
    configFile: join(demo, 'vite.config.ts'),
    preview: { port: 0, strictPort: false, open: false },
    logLevel: 'warn',
});
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('the demo preview server has no local URL');

const browser = await chromium.launch();
const errors: string[] = [];

async function open(width: number): Promise<Page> {
    const page = await browser.newPage({
        viewport: { width, height: 1200 },
        deviceScaleFactor: 2,
        colorScheme: 'light',
    });
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url!, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        await document.fonts.ready;
        // Transparent around the cards, so their rounded corners show.
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
    });
    return page;
}

async function save(name: string, png: Buffer): Promise<void> {
    const small = toPalettePng(png);
    writeFileSync(join(out, name), small);
    console.log(`${name}: ${(small.length / 1024).toFixed(0)} KB`);
}

mkdirSync(out, { recursive: true });

try {
    const page = await open(760);
    for (const mode of MODES) {
        await page
            .locator(`input[name="overlap"][value="${mode}"]`)
            .check({ force: true });
        // A caption naming the mode, inside the card the image shows.
        await page.evaluate((mode) => {
            const card = document.getElementById('page')!;
            let caption = card.querySelector<HTMLElement>('.shot-caption');
            if (!caption) {
                caption = document.createElement('p');
                caption.className = 'shot-caption';
                caption.style.cssText =
                    'margin:0 0 1rem;font:600 0.9375rem/1.4 var(--sans);color:var(--muted)';
                card.prepend(caption);
            }
            caption.textContent = `overlap: '${mode}'`;
        }, mode);
        await save(
            `overlap-${mode}.png`,
            await page
                .locator('#page')
                .screenshot({ omitBackground: true, animations: 'disabled' }),
        );
    }
    await page.close();

    // Hero: the wordmark, the pitch and the inspector naming the four
    // analyses under "full canopy", on the page's own background.
    const hero = await open(1100);
    await hero.evaluate(() => {
        document.documentElement.style.background = '';
        document.body.style.background = '';
        for (const el of document.querySelectorAll<HTMLElement>(
            '.theme, .install, .links, .controls, .hint, #reset',
        ))
            el.style.display = 'none';
    });
    await hero.locator('#passage .om-seg', { hasText: 'full canopy' }).click();
    await hero.mouse.move(0, 0);
    await hero.waitForSelector('#inspector .cards');
    const top = (await hero.locator('.intro').boundingBox())!;
    const bottom = (await hero.locator('.layout').boundingBox())!;
    await save(
        'hero.png',
        await hero.screenshot({
            animations: 'disabled',
            clip: {
                x: 0,
                y: top.y + 8,
                width: 1100,
                height: bottom.y + bottom.height + 32 - (top.y + 8),
            },
        }),
    );
} finally {
    await browser.close();
    await server.close();
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
