import type { ContractProps } from './types';

/**
 * The `ContractProps` fields of `props`, without the fields it leaves unset.
 * Fixtures and suite cases carry more (a fixture's `name`), which a component
 * given the whole object would pass on as attributes.
 */
export function propsOf(props: ContractProps): ContractProps {
    const picked: ContractProps = {
        text: props.text,
        highlights: props.highlights,
    };
    if (props.strategy !== undefined) picked.strategy = props.strategy;
    if (props.overlap !== undefined) picked.overlap = props.overlap;
    if (props.focusable !== undefined) picked.focusable = props.focusable;
    if (props.defaultColor !== undefined)
        picked.defaultColor = props.defaultColor;
    if (props.brush !== undefined) picked.brush = props.brush;
    if (props.describe !== undefined) picked.describe = props.describe;
    if (props.minSelectionLength !== undefined)
        picked.minSelectionLength = props.minSelectionLength;
    if (props.touchSelectionDelay !== undefined)
        picked.touchSelectionDelay = props.touchSelectionDelay;
    if (props.decoration !== undefined) picked.decoration = props.decoration;
    return picked;
}
