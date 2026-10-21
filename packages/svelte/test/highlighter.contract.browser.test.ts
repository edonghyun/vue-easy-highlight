// Runs the shared adapter contract (packages/adapter-contract) against the
// Highlighter component through ContractView. The props sit in a
// `$state.raw` box, so the suite's highlight objects reach the component
// unproxied; update() assigns a new props object and flushSync() runs the
// whole flush (DOM patch and effects) before returning. Every callback prop
// reaches the suite's record from the core callback that produced it.
import { defineAdapterContract } from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import { flushSync, mount, unmount } from 'svelte';
import ContractView from './ContractView.svelte';
import { rawState } from './state.svelte';

defineAdapterContract({
    name: 'svelte',
    async mount(host, initial, record) {
        const props = rawState<ContractProps>({ ...initial });
        const view = mount(ContractView, {
            target: host,
            props: {
                get props() {
                    return props.value;
                },
                record,
            },
        });
        flushSync();

        return {
            root: host.firstElementChild as HTMLElement,
            async update(next) {
                props.value = { ...props.value, ...next };
                flushSync();
            },
            async unmount() {
                await unmount(view);
            },
        };
    },
});
