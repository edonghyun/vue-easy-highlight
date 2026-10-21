// Runs the shared adapter contract (packages/adapter-contract) against
// createHighlighter. The highlighter renders into the host itself, so the host
// is the root, and every event reaches the suite through h.on().
import { defineAdapterContract } from '@overlapmark/adapter-contract';
import type { AdapterEvent } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import { createHighlighter } from '../src';

defineAdapterContract({
    name: 'dom',
    async mount(host, props) {
        const h = createHighlighter(host, props);
        const events: AdapterEvent[] = [];
        h.on('select', (detail) => events.push({ type: 'select', detail }));
        h.on('click', (detail) => events.push({ type: 'click', detail }));
        h.on('dblclick', (detail) => events.push({ type: 'dblclick', detail }));
        h.on('hover', (detail) => events.push({ type: 'hover', detail }));

        return {
            root: host,
            events,
            async update(next) {
                h.update(next);
            },
            async unmount() {
                h.destroy();
            },
        };
    },
});
