import { describe, expect, it } from 'vitest';
import * as core from '../src/index';
import * as dom from '../src/dom/index';

// Pins the runtime names each entry point exports. Adding or removing one is a
// public API change and must update this list deliberately. Type-only exports
// are erased at runtime, so this list does not cover them.
describe('@overlapmark/core entry point', () => {
    it('exports exactly the documented runtime API', () => {
        const names = Object.keys(core).sort();

        expect(names).toEqual([
            'DEFAULT_COLOR',
            'compareHighlights',
            'computeSegments',
            'defaultBrush',
            'findMatches',
            'highlightsInRange',
            'rootAttributes',
            'segmentAt',
            'segmentElements',
            'segmentKey',
        ]);
    });
});

describe('@overlapmark/core/dom entry point', () => {
    it('exports exactly the documented runtime API', () => {
        const names = Object.keys(dom).sort();

        expect(names).toEqual([
            'attachInteractions',
            'createRangeFromOffsets',
            'getOffsetFromPoint',
            'getSelectionOffsets',
            'getTextLength',
        ]);
    });
});
