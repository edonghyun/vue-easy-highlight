export const DEFAULT_COLOR = '#ddd6ff';

const STROKE = 'M0,31 C60,35 120,27 200,30 S330,33 400,30';

export function defaultBrush(color: string): string {
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 60' preserveAspectRatio='none'>` +
        `<path d='${STROKE}' fill='none' stroke='${color}' stroke-opacity='0.6' stroke-width='52'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
