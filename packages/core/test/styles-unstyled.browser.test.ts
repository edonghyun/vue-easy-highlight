import { describe, expect, it } from 'vitest';
// Intentionally does NOT import ../src/styles.css.
import { givenRenderedRoot } from './helpers/mount';

function givenUnstyledRoot(): HTMLElement {
    return givenRenderedRoot('abc', [
        { id: 'a', start: 0, end: 3, color: '#ff0000' },
    ]);
}

describe('without the stylesheet', () => {
    it('leaves the browser default <mark> background', () => {
        const root = givenUnstyledRoot();

        const cs = getComputedStyle(root.querySelector('mark')!);

        // Browser default <mark> is yellow; the library would make it translucent/none.
        expect(cs.backgroundColor).toBe('rgb(255, 255, 0)');
        expect(cs.backgroundImage).toBe('none');
    });

    it('leaves the root white-space at its default', () => {
        const root = givenUnstyledRoot();

        expect(getComputedStyle(root).whiteSpace).toBe('normal');
    });

    it('injects no om-* style rules', () => {
        givenUnstyledRoot();

        // The test harness may own a <style>; the library must contribute no om-* rules.
        const rules = [...document.styleSheets].flatMap((s) =>
            [...s.cssRules].map((r) => r.cssText),
        );
        expect(rules.filter((t) => t.includes('om-'))).toEqual([]);
    });
});
