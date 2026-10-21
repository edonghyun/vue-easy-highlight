import { describe, expect, it, vi } from 'vitest';
import { safeColor } from '../src/color';

describe('safeColor', () => {
    it.each([
        '#abc',
        '#aabbccdd',
        'rebeccapurple',
        'rgb(1 2 3)',
        'hsl(10 20% 30%)',
        'oklch(70% 0.1 200)',
        'color-mix(in srgb, red 30%, white)',
        'var(--brand)',
    ])('keeps the color %s', (color) => {
        expect(safeColor(color)).toBe(color);
    });

    it.each([
        'red; position: fixed',
        'red}body{x:y',
        'url(https://x)',
        'URL(x)',
        'expression(alert(1))',
        'a'.repeat(65),
        '</style>',
    ])('ignores the unsafe color %s', (color) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = safeColor(color);

        expect(result).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('ignoring unsafe highlight color'),
        );
        warn.mockRestore();
    });

    it('leaves an absent color absent without a warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(safeColor(undefined)).toBeUndefined();

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
