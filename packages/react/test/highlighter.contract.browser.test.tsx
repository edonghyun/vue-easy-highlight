// Runs the shared adapter contract (packages/adapter-contract) against the
// Highlighter component. Every render goes through flushSync, so mount() and
// update() resolve with the DOM patched and the layout effects run; every
// on* prop reaches the suite's record from the core callback that produced
// it, and the contract's decoration text is what renderDecoration returns.
import { defineAdapterContract, propsOf } from '@overlapmark/adapter-contract';
import type { ContractProps } from '@overlapmark/adapter-contract';
import '@overlapmark/core/styles.css';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Highlighter } from '../src';

defineAdapterContract({
    name: 'react',
    async mount(host, initial, record) {
        let props: ContractProps = { ...initial };
        const root = createRoot(host);
        const render = (): void => {
            // propsOf: fixtures carry extra fields (such as `name`) that
            // would land on the root div as attributes.
            const { decoration, ...rest } = propsOf(props);
            flushSync(() =>
                root.render(
                    <Highlighter
                        {...rest}
                        renderDecoration={decoration}
                        onSelect={(detail) =>
                            record({ type: 'select', detail })
                        }
                        onClick={(detail) => record({ type: 'click', detail })}
                        onDblClick={(detail) =>
                            record({ type: 'dblclick', detail })
                        }
                        onHover={(detail) => record({ type: 'hover', detail })}
                    />,
                ),
            );
        };
        render();

        return {
            root: host.firstElementChild as HTMLElement,
            async update(next) {
                props = { ...props, ...next };
                render();
            },
            async unmount() {
                flushSync(() => root.unmount());
            },
        };
    },
});
