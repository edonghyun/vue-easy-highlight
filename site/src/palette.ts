// The site's highlight colors. Under `overlap: 'multiply'`, hues from
// opposite sides of the wheel multiply into a muddy gray-brown, so every
// sample only stacks colors from one of these families; samples.test.ts
// holds every sample to a 75 degree spread at each character.

export const PALETTES = {
    /** Yellow through pink, about 64 degrees end to end. */
    warm: ['#ffd84d', '#ffbe3d', '#ffa45c', '#ff8a73', '#ff9cb8'],
    /** Cyan through periwinkle, about 53 degrees. */
    cool: ['#7fd6e6', '#8fd0ff', '#8cb4ff', '#a9a4ff'],
    /** One amber hue in six steps, for the layers slider. */
    mono: ['#ffe27a', '#ffd447', '#ffc53d', '#ffb547', '#ffa64d', '#ff9752'],
} as const satisfies Record<string, readonly string[]>;

/** The hue of a `#rrggbb` color, in degrees in [0, 360). */
export function hue(hex: string): number {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) throw new Error(`not a #rrggbb color: ${hex}`);
    const [r, g, b] = match.slice(1).map((c) => parseInt(c, 16) / 255) as [
        number,
        number,
        number,
    ];
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    if (delta === 0) return 0;
    const sector =
        max === r
            ? (g - b) / delta
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4;
    return (sector * 60 + 360) % 360;
}

/** The smallest arc of the hue wheel, in degrees, that holds every color. */
export function hueSpread(hexes: readonly string[]): number {
    if (hexes.length < 2) return 0;
    const hues = hexes.map(hue).sort((a, b) => a - b);
    let widestGap = 360 - hues.at(-1)! + hues[0]!;
    for (let i = 1; i < hues.length; i++)
        widestGap = Math.max(widestGap, hues[i]! - hues[i - 1]!);
    return 360 - widestGap;
}
