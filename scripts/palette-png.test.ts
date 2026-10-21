import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { toPalettePng } from './palette-png.ts';

const FILL = [0x5b, 0x9c, 0xff, 255];
const INK = [0x1a, 0x1f, 0x2b, 255];

/**
 * A 24x16 screenshot-like PNG: a flat fill, a transparent top-left corner
 * pixel, and a dark 4x4 "glyph" in the middle.
 */
function givenScreenshot(): Buffer {
    const png = new PNG({ width: 24, height: 16 });
    for (let y = 0; y < 16; y++)
        for (let x = 0; x < 24; x++) {
            const glyph = x >= 10 && x < 14 && y >= 6 && y < 10;
            png.data.set(glyph ? INK : FILL, (y * 24 + x) * 4);
        }
    png.data.set([0, 0, 0, 0], 0);
    return PNG.sync.write(png);
}

function pixel(png: PNG, x: number, y: number): number[] {
    const i = (y * png.width + x) * 4;
    return [...png.data.subarray(i, i + 4)];
}

describe('toPalettePng', () => {
    it('keeps the dimensions of the image', () => {
        const input = givenScreenshot();

        const output = PNG.sync.read(toPalettePng(input));

        expect([output.width, output.height]).toEqual([24, 16]);
    });

    it('keeps a transparent corner transparent and the flat fill exact', () => {
        const input = givenScreenshot();

        const output = PNG.sync.read(toPalettePng(input));

        expect(pixel(output, 0, 0)[3]).toBe(0);
        expect(pixel(output, 5, 3)).toEqual(FILL);
        expect(pixel(output, 11, 7)).toEqual(INK);
    });

    it('writes an indexed PNG that standard decoders read', () => {
        const input = givenScreenshot();

        const output = toPalettePng(input);

        // IHDR color type 3: indexed color
        expect(output[25]).toBe(3);
        expect(() => PNG.sync.read(output)).not.toThrow();
    });
});
