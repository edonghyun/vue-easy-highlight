export type { TextRange } from './offsets';
export {
    getSelectionOffsets,
    getOffsetFromPoint,
    createRangeFromOffsets,
    getTextLength,
} from './offsets';
export { attachInteractions } from './interactions';
export type { InteractionOptions } from './interactions';
export { captureViewState, restoreViewState } from './view-state';
export type { ViewState, RestoreViewStateOptions } from './view-state';
