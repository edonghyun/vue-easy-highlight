import { computeSegments } from '@overlapmark/core';
import { rootAttributes, segmentElements } from '@overlapmark/core/adapter';
import type { RenderOptions } from '@overlapmark/core';
import type { ContractProps } from './types';
import { classTokens } from './serialize';
import type { ElementTree, RootTree, TreeNode } from './serialize';

/**
 * The tree every adapter must render for `props`, built from the core render
 * model (`computeSegments` + `segmentElements` + `rootAttributes`) without
 * touching the DOM. With `props.decoration`, the innermost element of each
 * highlighted segment holds its decoration after the text, unless the
 * decoration is `''`.
 */
export function expectedTree(props: ContractProps): RootTree {
    const options: RenderOptions = {
        strategy: props.strategy,
        overlap: props.overlap,
        focusable: props.focusable,
        defaultColor: props.defaultColor,
        brush: props.brush,
        describe: props.describe,
    };
    const root = rootAttributes(options);
    return {
        classes: classTokens(root.className),
        attrs: { ...root.attrs },
        style: { ...root.style },
        children: computeSegments(props.text, [...props.highlights]).map(
            (segment) => {
                const innermost: [TreeNode, ...TreeNode[]] = [segment.text];
                const decoration =
                    props.decoration && segment.depth > 0
                        ? props.decoration(segment)
                        : '';
                // '' is no decoration: the segment gets no container.
                if (decoration !== '')
                    innermost.push(decorationTree(decoration));
                const [outermost] = segmentElements(
                    segment,
                    options,
                ).reduceRight<[TreeNode, ...TreeNode[]]>(
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
        children: [text],
    };
}
