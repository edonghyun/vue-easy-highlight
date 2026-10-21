import type { ContractProps } from '@overlapmark/adapter-contract';
import type { Segment } from '@overlapmark/core';

/** The data props of ServerView: what a server receives to render it. */
export interface ServerViewProps {
    props: Omit<ContractProps, 'decoration'>;
    /** Decorate each highlighted segment with `decorationOf` it. */
    decorated?: boolean;
}

/** The decoration text ServerView renders for `segment` when decorated. */
export function decorationOf(segment: Segment): string {
    return `[${segment.highlights.map((h) => h.id).join('+')}]`;
}
