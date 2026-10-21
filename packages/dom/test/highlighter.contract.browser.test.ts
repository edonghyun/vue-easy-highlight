// Runs the shared adapter contract (packages/adapter-contract) against
// createHighlighter. The highlighter renders into the host itself, so the host
// is the root, every event reaches the suite's record through h.on(), and the
// contract's decoration text is what decorate() returns.
import { defineAdapterContract } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import { createHighlighter } from '../src';

defineAdapterContract({
    name: 'dom',
    async mount(host, props, record) {
        const { decoration, ...options } = props;
        const h = createHighlighter(host, { ...options, decorate: decoration });
        h.on('select', (detail) => record({ type: 'select', detail }));
        h.on('click', (detail) => record({ type: 'click', detail }));
        h.on('dblclick', (detail) => record({ type: 'dblclick', detail }));
        h.on('hover', (detail) => record({ type: 'hover', detail }));

        return {
            root: host,
            async update({ decoration, ...next }) {
                h.update(
                    decoration === undefined
                        ? next
                        : { ...next, decorate: decoration },
                );
            },
            async unmount() {
                h.destroy();
            },
        };
    },
});
