import { describe, expect, it } from 'vitest';
// Intentionally does NOT import ../src/styles.css.
import { computeSegments, rootAttributes, segmentElements } from '../src';

describe('without the stylesheet', () => {
    it('mark has no library background and the library injects no <style>', () => {
        const root = document.createElement('div');
        const r = rootAttributes();
        root.className = r.className;
        root.setAttribute('data-om-strategy', r.attrs['data-om-strategy']);
        const [seg] = computeSegments('abc', [{ id: 'a', start: 0, end: 3, color: '#ff0000' }]);
        const [spec] = segmentElements(seg);
        const el = document.createElement(spec.tag);
        el.className = spec.className;
        for (const [k, v] of Object.entries(spec.style)) el.style.setProperty(k, v);
        el.textContent = 'abc';
        root.appendChild(el);
        document.body.appendChild(root);

        const cs = getComputedStyle(el);
        // Browser default <mark> is yellow; the library would make it translucent/none.
        expect(cs.backgroundColor).toBe('rgb(255, 255, 0)');
        expect(cs.backgroundImage).toBe('none');
        expect(getComputedStyle(root).whiteSpace).toBe('normal');
        // The test harness may own a <style>; the library must contribute no om-* rules.
        const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText));
        expect(rules.filter((t) => t.includes('om-'))).toEqual([]);
    });
});
