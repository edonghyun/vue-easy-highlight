import {
    computeSegments,
    rootAttributes,
    segmentElements,
} from '@overlapmark/core';
import type { RenderOptions } from '@overlapmark/core';
import type { ContractProps } from './types';
import { classTokens } from './serialize';
import type { ElementTree, RootTree, TreeNode } from './serialize';

/**
 * The tree every adapter must render for `props`, built from the core render
 * model (`computeSegments` + `segmentElements` + `rootAttributes`) without
 * touching the DOM. With `props.decoration`, the innermost element of each
 * highlighted segment holds its decoration after the text.
 */
export function expectedTree(props: ContractProps): RootTree {
    const options: RenderOptions = {
        strategy: props.strategy,
        focusable: props.focusable,
    };
    const root = rootAttributes(options);
    return {
        classes: classTokens(root.className),
        attrs: { ...root.attrs },
        children: computeSegments(props.text, [...props.highlights]).map(
            (segment) => {
                const innermost: TreeNode[] = [segment.text];
                if (props.decoration && segment.depth > 0)
                    innermost.push(decorationTree(props.decoration(segment)));
                const [outermost] = segmentElements(
                    segment,
                    options,
                ).reduceRight<TreeNode[]>(
                    (children, spec) => [
                        {
                            tag: spec.tag,
                            classes: classTokens(spec.className),
                            attrs: { ...spec.attrs },
                            style: { ...spec.style },
                            children,
                        },
                    ],
                    innermost,
                );
                return outermost;
            },
        ),
    };
}

/** The decoration container of the DOM contract: skipped by offsets, hidden from assistive technology. */
function decorationTree(text: string): ElementTree {
    return {
        tag: 'span',
        classes: [],
        attrs: { 'data-om-skip': '', 'aria-hidden': 'true' },
        style: {},
        children: text === '' ? [] : [text],
    };
}
