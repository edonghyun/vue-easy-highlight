export type { Highlight, Segment } from './types';
export {
    computeSegments,
    compareHighlights,
    segmentAt,
    highlightsInRange,
} from './segments';
export { findMatches } from './matches';
export type { FindMatchesOptions } from './matches';
export { DEFAULT_COLOR, defaultBrush } from './brush';
export {
    segmentElements,
    segmentKey,
    rootAttributes,
    decorationTarget,
} from './render';
export type {
    Strategy,
    RenderOptions,
    ElementSpec,
    DecorationTarget,
} from './render';
export type {
    SelectDetail,
    PointDetail,
    HoverDetail,
    InteractionHandlers,
} from './events';
