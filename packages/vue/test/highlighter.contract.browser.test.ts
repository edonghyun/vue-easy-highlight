// Runs the shared adapter contract (packages/adapter-contract) against the
// Highlighter component. A small app renders it from reactive props, so
// update() is a plain prop change followed by Vue's flush; every emit reaches
// the suite's record from the core callback that produced it, and the
// contract's decoration text is what the decoration slot renders.
import { defineAdapterContract, propsOf } from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import type { Segment } from '@overlapmark/core';
import { createApp, h, nextTick, shallowReactive } from 'vue';
import { Highlighter } from '../src';

defineAdapterContract({
    name: 'vue',
    async mount(host, initial, record) {
        // Shallow, so the highlights reach the component as the suite's objects.
        const props = shallowReactive<ContractProps>({ ...initial });
        const app = createApp({
            render: () => {
                // propsOf: fixtures carry extra fields (such as `name`) that
                // would fall through as attributes.
                const { decoration, ...rest } = propsOf(props);
                return h(
                    Highlighter,
                    {
                        ...rest,
                        onSelect: (detail) =>
                            record({ type: 'select', detail }),
                        onClick: (detail) => record({ type: 'click', detail }),
                        onDblclick: (detail) =>
                            record({ type: 'dblclick', detail }),
                        onHover: (detail) => record({ type: 'hover', detail }),
                    },
                    decoration && {
                        decoration: ({ segment }: { segment: Segment }) =>
                            decoration(segment),
                    },
                );
            },
        });
        app.mount(host);

        return {
            root: host.firstElementChild as HTMLElement,
            async update(next) {
                Object.assign(props, next);
                await nextTick();
            },
            async unmount() {
                app.unmount();
            },
        };
    },
});
