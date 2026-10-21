// Runs the shared adapter contract against a reference adapter assembled only
// from core primitives, so the suite itself is proven on the code every real
// adapter builds on.
import {
    defineAdapterContract,
    expectedTree,
    partialOverlap,
    serializeRoot,
} from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '../src/styles.css';
import { computeSegments } from '../src';
import type { Segment } from '../src';
import {
    attachInteractions,
    captureViewState,
    restoreViewState,
} from '../src/dom';
import { describe, expect, it } from 'vitest';
import { givenInDocument, renderInto } from './helpers/mount';

defineAdapterContract({
    name: 'reference',
    async mount(host, initial, record) {
        let props: ContractProps = { ...initial };
        let segments: readonly Segment[] = [];
        const root = document.createElement('div');
        host.append(root);

        const render = (): void => {
            segments = computeSegments(props.text, [...props.highlights]);
            renderInto(root, props.text, props.highlights, props);
        };
        render();

        const detach = attachInteractions(root, {
            getText: () => props.text,
            getSegments: () => segments,
            get minSelectionLength() {
                return props.minSelectionLength;
            },
            get touchSelectionDelay() {
                return props.touchSelectionDelay;
            },
            onSelect: (detail) => record({ type: 'select', detail }),
            onClick: (detail) => record({ type: 'click', detail }),
            onDblclick: (detail) => record({ type: 'dblclick', detail }),
            onHover: (detail) => record({ type: 'hover', detail }),
        });

        return {
            root,
            // Re-renders from scratch; core's view state keeps the selection
            // and focus the contract requires.
            async update(next) {
                const view = captureViewState(root);

                props = { ...props, ...next };
                render();

                restoreViewState(root, view);
            },
            async unmount() {
                detach();
                root.remove();
            },
        };
    },
});

// Outside the shared suite: the Svelte adapter cannot leave out the container
// for a decoration snippet that renders nothing, so the suite never passes ''.
describe('reference adapter: a decoration of empty text', () => {
    it("renders no decoration container for a segment whose decoration is '', as the oracle expects", () => {
        const props: ContractProps = {
            ...partialOverlap,
            decoration: (segment) => (segment.depth > 1 ? 'overlap' : ''),
        };
        const root = givenInDocument(document.createElement('div'));

        renderInto(root, props.text, props.highlights, props);

        expect(serializeRoot(root)).toEqual(expectedTree(props));
        // Live positive control: the overlap segment [6,15) is decorated.
        expect(
            [...root.querySelectorAll('[data-om-skip]')].map((el) =>
                el.closest('[data-om-start]')?.getAttribute('data-om-start'),
            ),
        ).toEqual(['6']);
    });
});
