import type { Highlight, Segment } from './types';

/** Payload of `onSelect`: a confirmed text selection inside the root. */
export interface SelectDetail<T = unknown> {
    start: number;
    end: number;
    text: string;
    /**
     * The bounding rect of the selected text inside the root, clipped to it,
     * in the viewport of the root's own window.
     */
    rect: DOMRect;
    highlights: Highlight<T>[];
}

/** Payload of `onClick` / `onDblclick` (mouse, or Enter/Space on a focused highlight). */
export interface PointDetail<T = unknown> {
    offset: number;
    segment: Segment<T>;
    highlights: Highlight<T>[];
    event: MouseEvent | KeyboardEvent;
}

/**
 * Payload of `onHover`: the mouse entered or left a highlighted segment.
 * A `leave` carries the same `segment` object as its `enter`.
 *
 * A `leave` with `event: null` was not caused by the pointer: the listeners
 * were detached (adapter destroyed or unmounted), or a re-render left a
 * different segment (other `start` or highlight ids) under the still pointer.
 * A segment re-rendered unchanged stays hovered and emits nothing.
 */
export type HoverDetail<T = unknown> =
    | {
          type: 'enter';
          segment: Segment<T>;
          highlights: Highlight<T>[];
          event: PointerEvent;
      }
    | {
          type: 'leave';
          segment: Segment<T>;
          highlights: Highlight<T>[];
          event: PointerEvent | null;
      };

export interface InteractionHandlers<T = unknown> {
    onSelect?: (d: SelectDetail<T>) => void;
    onClick?: (d: PointDetail<T>) => void;
    onDblclick?: (d: PointDetail<T>) => void;
    onHover?: (d: HoverDetail<T>) => void;
}
