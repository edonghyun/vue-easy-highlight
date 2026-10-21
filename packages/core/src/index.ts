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
export { segmentElements, segmentKey, rootAttributes } from './render';
export type { Strategy, RenderOptions, ElementSpec } from './render';
export type {
    SelectDetail,
    PointDetail,
    HoverDetail,
    InteractionHandlers,
} from './events';
