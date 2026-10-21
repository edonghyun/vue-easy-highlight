/**
 * For adapter authors; may change in minor versions.
 *
 * The helpers the framework adapters build on: turning segments into element
 * descriptions, keys and root attributes, and the types of those descriptions.
 * Applications use `@overlapmark/core` instead.
 */
export { compareHighlights } from './segments';
export {
    segmentElements,
    segmentKey,
    rootAttributes,
    decorationTarget,
} from './render';
export type { ElementSpec, DecorationTarget } from './render';
export type { InteractionHandlers } from './events';
