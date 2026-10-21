import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

export interface Fixture {
    text: string;
    highlights: { id: string; start: number; end: number }[];
}

export const fixtures: Record<
    'overlaps' | 'unicode' | 'wrap' | 'whitespace',
    Fixture
> = JSON.parse(
    readFileSync(new URL('../fixtures.json', import.meta.url), 'utf8'),
);

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Opens the harness page with `params` and waits until it is mounted. */
export async function givenHarness(
    page: Page,
    params: Record<string, string> = {},
): Promise<void> {
    await page.goto(`/harness.html?${new URLSearchParams(params)}`);
    await expect(
        page.locator('body[data-harness-ready="true"]'),
    ).toBeAttached();
}

export function rootOf(page: Page): Locator {
    return page.locator('.om-root');
}

/**
 * The DOM Range over the characters `[start, end)` of `root`'s text, the way
 * the library counts them: decorations (`[data-om-skip]`) are not text.
 * Runs in the page, so it must stay self-contained.
 */
function textRange(root: Element, start: number, end: number): Range {
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
            node.parentElement?.closest('[data-om-skip]')
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
    });
    let pos = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = (node as Text).length;
        if (!started && start < pos + length) {
            range.setStart(node, start - pos);
            started = true;
        }
        if (started && end <= pos + length) {
            range.setEnd(node, end - pos);
            return range;
        }
        pos += length;
    }
    throw new Error(`[${start}, ${end}) is outside the text (${pos})`);
}

/** Runs `fn` in the page with the root element and `textRange`. */
function onRoot<A, R>(
    page: Page,
    fn: (root: Element, range: typeof textRange, arg: A) => R,
    arg: A,
): Promise<R> {
    return rootOf(page).evaluate(
        (root, [fnSource, rangeSource, a]) =>
            (0, eval)(`(${fnSource})`)(root, (0, eval)(`(${rangeSource})`), a),
        [fn.toString(), textRange.toString(), arg] as const,
    );
}

/** The client rect of the character at `offset` (both halves of a surrogate pair). */
export function charBox(page: Page, offset: number): Promise<Box> {
    return onRoot(
        page,
        (root, range, at) => {
            const r = range(root, at, at + 1);
            const unit = r.toString().charCodeAt(0);
            if (unit >= 0xd800 && unit < 0xdc00)
                r.setEnd(r.endContainer, r.endOffset + 1);
            const rect = [...r.getClientRects()].find((c) => c.width > 0);
            if (!rect) throw new Error(`character ${at} has no box`);
            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            };
        },
        offset,
    );
}

/**
 * A real mouse drag that selects `[start, end)`: down just inside the left
 * half of character `start`, up just inside the right half of `end - 1`.
 */
export async function dragSelect(
    page: Page,
    start: number,
    end: number,
): Promise<void> {
    const from = await charBox(page, start);
    const to = await charBox(page, end - 1);

    await page.mouse.move(from.x + from.width * 0.25, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width * 0.75, to.y + to.height / 2, {
        steps: 5,
    });
    await page.mouse.up();
}

export type LogRecord = Record<string, unknown>;

/**
 * The harness event log, parsed. With `event`, only that event's records;
 * without, every record with its `event` name added.
 */
export async function logEntries(
    page: Page,
    event?: 'select' | 'click' | 'dblclick' | 'hover',
): Promise<LogRecord[]> {
    const items = page.locator(
        event ? `#log li[data-event="${event}"]` : '#log li',
    );
    const entries = await items.evaluateAll((lis) =>
        lis.map((li) => ({
            event: (li as HTMLElement).dataset.event,
            text: li.textContent ?? '',
        })),
    );
    return entries.map(({ event: name, text }) =>
        event ? JSON.parse(text) : { event: name, ...JSON.parse(text) },
    );
}

/** What the element holding character `offset` says about its segment. */
export function segmentAt(
    page: Page,
    offset: number,
): Promise<{ highlighted: boolean; depth: string | null }> {
    return onRoot(
        page,
        (root, range, at) => {
            const node = range(root, at, at + 1).startContainer.parentElement!;
            return {
                highlighted: node.closest('.om-hl') !== null,
                depth: node
                    .closest('[data-om-start]')!
                    .getAttribute('data-depth'),
            };
        },
        offset,
    );
}

/** How many line boxes the root's text occupies. */
export function lineCount(page: Page): Promise<number> {
    return onRoot(
        page,
        (root, range) => {
            const length = [...root.querySelectorAll('[data-om-skip]')].reduce(
                (n, skipped) => n - (skipped.textContent ?? '').length,
                (root.textContent ?? '').length,
            );
            const text = range(root, 0, length);
            const tops = [...text.getClientRects()]
                .filter((r) => r.width > 0)
                .map((r) => Math.round(r.top));
            return new Set(tops).size;
        },
        null,
    );
}

/**
 * Every `.om-hl` covers exactly its characters: on each line, its client
 * rects (content box, so without the highlight's padding) match the rects
 * of a Range over the same characters within 1px.
 */
export async function expectHighlightsOnTheirCharacters(
    page: Page,
): Promise<void> {
    const report = await onRoot(
        page,
        (root, range) => {
            const marks = [...root.querySelectorAll('.om-hl')];
            const mismatches: string[] = [];
            for (const mark of marks) {
                const start = Number(
                    mark
                        .closest('[data-om-start]')!
                        .getAttribute('data-om-start'),
                );
                let length = 0;
                const texts = document.createTreeWalker(
                    mark,
                    NodeFilter.SHOW_TEXT,
                );
                for (let n = texts.nextNode(); n; n = texts.nextNode()) {
                    if (!n.parentElement!.closest('[data-om-skip]'))
                        length += (n as Text).length;
                }
                const style = getComputedStyle(mark);
                const px = (v: string): number => parseFloat(v) || 0;
                const inset = {
                    top: px(style.paddingTop) + px(style.borderTopWidth),
                    bottom:
                        px(style.paddingBottom) + px(style.borderBottomWidth),
                    left: px(style.paddingLeft) + px(style.borderLeftWidth),
                    right: px(style.paddingRight) + px(style.borderRightWidth),
                };
                // One box per line: a Range reports a line's hanging space
                // as a rect of its own, an inline element does not.
                const perLine = (rects: number[][]): number[][] => {
                    const lines: number[][] = [];
                    for (const r of rects) {
                        const line = lines.find(
                            (l) => Math.abs(l[1] - r[1]) <= 1,
                        );
                        if (!line) lines.push([...r]);
                        else {
                            line[0] = Math.min(line[0], r[0]);
                            line[2] = Math.max(line[2], r[2]);
                        }
                    }
                    return lines;
                };
                const boxes = perLine(
                    [...mark.getClientRects()]
                        .filter((r) => r.width > 0)
                        .map((r) => [
                            r.left + inset.left,
                            r.top + inset.top,
                            r.right - inset.right,
                            r.bottom - inset.bottom,
                        ]),
                );
                const chars = perLine(
                    [...range(root, start, start + length).getClientRects()]
                        .filter((r) => r.width > 0)
                        .map((r) => [r.left, r.top, r.right, r.bottom]),
                );
                const same =
                    boxes.length === chars.length &&
                    boxes.every((b, i) =>
                        b.every((v, j) => Math.abs(v - chars[i][j]) <= 1),
                    );
                if (!same)
                    mismatches.push(
                        `[${start}, ${start + length}): highlight ${JSON.stringify(boxes)} vs text ${JSON.stringify(chars)}`,
                    );
            }
            return { count: marks.length, mismatches };
        },
        null,
    );

    expect(report.count, 'highlights to check').toBeGreaterThan(0);
    expect(report.mismatches).toEqual([]);
}

export type Rgb = [number, number, number];

function luminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The background colour behind each character at `offsets`: its brightest
 * pixel in a screenshot of the root. Glyph pixels are darker than what is
 * behind them, so the brightest one is the highlight background.
 */
export async function backgroundsAt(
    page: Page,
    offsets: number[],
): Promise<Rgb[]> {
    const shot = PNG.sync.read(
        await rootOf(page).screenshot({ scale: 'css', animations: 'disabled' }),
    );
    const origin = (await rootOf(page).boundingBox())!;
    const backgrounds: Rgb[] = [];
    for (const offset of offsets) {
        const box = await charBox(page, offset);
        let brightest: Rgb = [0, 0, 0];
        for (
            let y = Math.ceil(box.y - origin.y) + 1;
            y < Math.floor(box.y + box.height - origin.y) - 1;
            y++
        ) {
            for (
                let x = Math.ceil(box.x - origin.x) + 1;
                x < Math.floor(box.x + box.width - origin.x) - 1;
                x++
            ) {
                const i = (y * shot.width + x) * 4;
                const pixel: Rgb = [
                    shot.data[i],
                    shot.data[i + 1],
                    shot.data[i + 2],
                ];
                if (luminance(pixel) > luminance(brightest)) brightest = pixel;
            }
        }
        backgrounds.push(brightest);
    }
    return backgrounds;
}

/** The background luminance at each character strictly decreases along `offsets`. */
export async function expectLuminanceDecreasing(
    page: Page,
    offsets: number[],
): Promise<void> {
    const luminances = (await backgroundsAt(page, offsets)).map(luminance);

    for (let i = 1; i < offsets.length; i++) {
        expect(
            luminances[i],
            `luminance at ${offsets[i]} below ${offsets[i - 1]} (${luminances.join(', ')})`,
        ).toBeLessThan(luminances[i - 1]);
    }
}

/** The classes of the innermost highlight element holding character `offset`. */
export function highlightClassesAt(
    page: Page,
    offset: number,
): Promise<string[]> {
    return onRoot(
        page,
        (root, range, at) => {
            const node = range(root, at, at + 1).startContainer.parentElement!;
            return [...(node.closest('.om-hl')?.classList ?? [])];
        },
        offset,
    );
}

/** The centre of the character at `offset`, in viewport coordinates. */
export async function charCentre(
    page: Page,
    offset: number,
): Promise<{ x: number; y: number }> {
    const box = await charBox(page, offset);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A real mouse click on the centre of the character at `offset`. */
export async function clickAt(page: Page, offset: number): Promise<void> {
    const { x, y } = await charCentre(page, offset);
    await page.mouse.click(x, y);
}

/**
 * Passes `highlights` to the component through the harness's update
 * controls, without moving focus or the selection the way typing into the
 * textarea and clicking the button would.
 */
export async function applyHighlights(
    page: Page,
    highlights: object[],
): Promise<void> {
    // The native setter plus an `input` event, as typing would do: a
    // framework binding (v-model, a React controlled textarea, bind:value)
    // only sees a value set this way.
    await page.locator('#highlights-json').evaluate((el, json) => {
        Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!.call(el, json);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, JSON.stringify(highlights));
    await page.locator('#apply').dispatchEvent('click');
}

/**
 * The text the browser would copy from the root: the current selection,
 * clipped to the root, as `Selection.toString()` serializes it.
 */
export function selectedTextInRoot(page: Page): Promise<string> {
    return rootOf(page).evaluate((root) => {
        const selection = window.getSelection()!;
        const range = selection.getRangeAt(0).cloneRange();
        const bounds = document.createRange();
        bounds.selectNodeContents(root);
        if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0)
            range.setStart(bounds.startContainer, bounds.startOffset);
        if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0)
            range.setEnd(bounds.endContainer, bounds.endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        return selection.toString();
    });
}
