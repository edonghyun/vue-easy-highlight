// Renders the README images into docs-assets/ from the built site (site/):
// one per overlap mode, from the docs page's overlap examples, and a hero of
// the demo's opening. Run with `pnpm docs:images`. The pages are captured at
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

async function open(path: string, width: number): Promise<Page> {
    const page = await browser.newPage({
        viewport: { width, height: 1200 },
        deviceScaleFactor: 2,
        colorScheme: 'light',
    });
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(new URL(path, url).href, { waitUntil: 'networkidle' });
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
    const docs = await open('docs/', 760);
    for (const mode of MODES) {
        await save(
            `overlap-${mode}.png`,
            await docs
                .locator(`#ex-modes [data-mode="${mode}"]`)
                .screenshot({ omitBackground: true, animations: 'disabled' }),
        );
    }
    await docs.close();

    // Hero: the title, the pitch, the buttons and the seeded sentence with
    // its status line, on the page's own background.
    const hero = await open('', 1100);
    await hero.evaluate(() => {
        document.documentElement.style.background = '';
        document.body.style.background = '';
    });
    const top = (await hero.locator('.intro').boundingBox())!;
    const bottom = (await hero.locator('#hero-status').boundingBox())!;
    await save(
        'hero.png',
        await hero.screenshot({
            animations: 'disabled',
            clip: {
                x: top.x - 24,
                y: top.y + 32,
                width: top.width + 48,
                height: bottom.y + bottom.height + 24 - (top.y + 32),
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
