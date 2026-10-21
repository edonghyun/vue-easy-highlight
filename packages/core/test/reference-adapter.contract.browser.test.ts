// Runs the shared adapter contract against a reference adapter assembled only
// from core primitives, so the suite itself is proven on the code every real
// adapter builds on.
import { defineAdapterContract } from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '../src/styles.css';
import { computeSegments } from '../src';
import type { Segment } from '../src';
import {
    attachInteractions,
    captureViewState,
    restoreViewState,
} from '../src/dom';
import { renderInto } from './helpers/mount';

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
                const textChanged =
                    next.text !== undefined && next.text !== props.text;

                props = { ...props, ...next };
                render();

                restoreViewState(root, view, { textChanged });
            },
            async unmount() {
                detach();
                root.remove();
            },
        };
    },
});
