// Re-encodes a screenshot as a 256-color palette PNG, which is a fraction of
// the size of the truecolor PNG a browser writes. The images are flat fills
// and antialiased text, so median-cut quantization without dithering keeps
// them crisp. Alpha is quantized with the color, so transparent corners
// stay transparent.
import { crc32, deflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

interface Bin {
    count: number;
    rgba: [number, number, number, number];
}

const key = (r: number, g: number, b: number, a: number): number =>
    ((r >> 3) << 14) | ((g >> 3) << 9) | ((b >> 3) << 4) | (a >> 4);

/** The pixels of `data`, binned to 5 bits per color and 4 bits of alpha. */
function histogram(data: Buffer): Map<number, Bin> {
    const bins = new Map<number, Bin>();
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;
        const k = key(r, g, b, a);
        const bin = bins.get(k);
        if (bin) {
            bin.count += 1;
            bin.rgba[0] += r;
            bin.rgba[1] += g;
            bin.rgba[2] += b;
            bin.rgba[3] += a;
        } else bins.set(k, { count: 1, rgba: [r, g, b, a] });
    }
    for (const bin of bins.values())
        bin.rgba = bin.rgba.map((v) => v / bin.count) as Bin['rgba'];
    return bins;
}

/** Median cut: split the most populous wide box until there are `size`. */
function medianCut(bins: Bin[], size: number): Bin[][] {
    const boxes: Bin[][] = [bins];
    while (boxes.length < size) {
        let best = -1;
        let bestScore = 0;
        let bestChannel = 0;
        boxes.forEach((box, i) => {
            if (box.length < 2) return;
            for (let c = 0; c < 4; c++) {
                let lo = Infinity;
                let hi = -Infinity;
                let count = 0;
                for (const bin of box) {
                    lo = Math.min(lo, bin.rgba[c]!);
                    hi = Math.max(hi, bin.rgba[c]!);
                    count += bin.count;
                }
                const score = (hi - lo) * Math.sqrt(count);
                if (score > bestScore) {
                    bestScore = score;
                    best = i;
                    bestChannel = c;
                }
            }
        });
        if (best < 0) break;
        const box = boxes[best]!;
        box.sort((a, b) => a.rgba[bestChannel]! - b.rgba[bestChannel]!);
        const total = box.reduce((n, bin) => n + bin.count, 0);
        let seen = 0;
        let cut = 1;
        for (; cut < box.length - 1; cut++) {
            seen += box[cut - 1]!.count;
            if (seen >= total / 2) break;
        }
        boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
    }
    return boxes;
}

function chunk(type: string, body: Buffer): Buffer {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0);
    return Buffer.concat([head, body, crc]);
}

/** `png` (any PNG) as an indexed PNG of at most 256 colors. */
export function toPalettePng(png: Buffer): Buffer {
    const { width, height, data } = PNG.sync.read(png);
    const bins = histogram(data);
    const palette = medianCut([...bins.values()], 256).map((box) => {
        const total = box.reduce((n, bin) => n + bin.count, 0);
        return [0, 1, 2, 3].map((c) =>
            Math.round(
                box.reduce((s, bin) => s + bin.rgba[c]! * bin.count, 0) / total,
            ),
        );
    });

    const nearest = new Map<number, number>();
    const indexOf = (k: number, bin: Bin): number => {
        let found = nearest.get(k);
        if (found !== undefined) return found;
        let best = Infinity;
        found = 0;
        palette.forEach((p, i) => {
            let d = 0;
            for (let c = 0; c < 4; c++) d += (p[c]! - bin.rgba[c]!) ** 2;
            if (d < best) {
                best = d;
                found = i;
            }
        });
        nearest.set(k, found);
        return found;
    };

    const rows = Buffer.alloc((width + 1) * height);
    for (let y = 0; y < height; y++) {
        rows[y * (width + 1)] = 0; // filter: none
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const k = key(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!);
            rows[y * (width + 1) + 1 + x] = indexOf(k, bins.get(k)!);
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.set([8, 3, 0, 0, 0], 8); // 8-bit indexed, no interlace
    const alphas = palette.map((p) => p[3]!);
    let lastTranslucent = alphas.length - 1;
    while (lastTranslucent >= 0 && alphas[lastTranslucent] === 255)
        lastTranslucent -= 1;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('PLTE', Buffer.from(palette.flatMap((p) => p.slice(0, 3)))),
        ...(lastTranslucent >= 0
            ? [chunk('tRNS', Buffer.from(alphas.slice(0, lastTranslucent + 1)))]
            : []),
        chunk('IDAT', deflateSync(rows, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
