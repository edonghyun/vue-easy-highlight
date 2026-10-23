import { describe, expect, test } from 'vitest';
import { hue, hueSpread } from './palette';

describe('hue', () => {
    test('reads the hue of #rrggbb colors in degrees', () => {
        expect(hue('#ff0000')).toBe(0);
        expect(hue('#00ff00')).toBe(120);
        expect(hue('#0000ff')).toBe(240);
    });

    test('rejects anything but #rrggbb', () => {
        expect(() => hue('red')).toThrow();
    });
});

describe('hueSpread', () => {
    test('measures the smallest arc across 0 degrees', () => {
        expect(hueSpread(['#ff0000', '#ff00ff'])).toBe(60);
    });

    test('measures opposite hues as half the wheel', () => {
        expect(hueSpread(['#ffff00', '#0000ff'])).toBe(180);
    });

    test('is 0 for fewer than two colors', () => {
        expect(hueSpread(['#ff0000'])).toBe(0);
        expect(hueSpread([])).toBe(0);
    });
});
