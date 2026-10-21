// Runs the shared adapter contract against a reference adapter assembled only
// from core primitives, so the suite itself is proven on the code every real
// adapter builds on.
import { defineAdapterContract } from '@overlapmark/adapter-contract';
import type {
    AdapterEvent,
    ContractProps,
} from '@overlapmark/adapter-contract';
import '../src/styles.css';
import { computeSegments } from '../src';
import type { Segment } from '../src';
import {
    attachInteractions,
    createRangeFromOffsets,
    getSelectionOffsets,
} from '../src/dom';
import { renderInto } from './helpers/mount';

defineAdapterContract({
    name: 'reference',
    async mount(host, initial) {
        let props: ContractProps = { ...initial };
        let segments: readonly Segment[] = [];
        const events: AdapterEvent[] = [];
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
            onSelect: (detail) => events.push({ type: 'select', detail }),
            onClick: (detail) => events.push({ type: 'click', detail }),
            onDblclick: (detail) => events.push({ type: 'dblclick', detail }),
            onHover: (detail) => events.push({ type: 'hover', detail }),
        });

        return {
            root,
            events,
            // Re-renders from scratch, restoring the selection by offset (spec
            // §6) and the focused segment by its start offset. Focus restore is
            // not in the spec; the contract's updates group requires it.
            async update(next) {
                const selection = window.getSelection();
                const saved = getSelectionOffsets(root, selection);
                const active = document.activeElement;
                const focused =
                    active && root.contains(active)
                        ? active
                              .closest('[data-om-start]')
                              ?.getAttribute('data-om-start')
                        : null;

                props = { ...props, ...next };
                render();

                const range =
                    saved &&
                    createRangeFromOffsets(root, saved.start, saved.end);
                if (range && selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                if (focused != null)
                    root.querySelector<HTMLElement>(
                        `[data-om-start="${focused}"][tabindex]`,
                    )?.focus();
            },
            async unmount() {
                detach();
                root.remove();
            },
        };
    },
});
