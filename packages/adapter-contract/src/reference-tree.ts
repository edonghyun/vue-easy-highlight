import {
    computeSegments,
    rootAttributes,
    segmentElements,
} from '@overlapmark/core';
import type { RenderOptions } from '@overlapmark/core';
import type { ContractProps } from './types';
import { classTokens } from './serialize';
import type { RootTree, TreeNode } from './serialize';

/**
 * The tree every adapter must render for `props`, built from the core render
 * model (`computeSegments` + `segmentElements` + `rootAttributes`) without
 * touching the DOM.
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
            (segment) =>
                segmentElements(segment, options).reduceRight<TreeNode>(
                    (child, spec) => ({
                        tag: spec.tag,
                        classes: classTokens(spec.className),
                        attrs: { ...spec.attrs },
                        style: { ...spec.style },
                        children: [child],
                    }),
                    segment.text,
                ),
        ),
    };
}
