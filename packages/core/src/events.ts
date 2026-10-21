import type { Highlight, Segment } from './types';

/** Payload of `onSelect`: a confirmed text selection inside the root. */
export interface SelectDetail<T = unknown> {
    start: number;
    end: number;
    text: string;
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

/** Payload of `onHover`: the mouse entered or left a highlighted segment. */
export interface HoverDetail<T = unknown> {
    type: 'enter' | 'leave';
    segment: Segment<T>;
    highlights: Highlight<T>[];
    event: PointerEvent;
}

export interface InteractionHandlers<T = unknown> {
    onSelect?: (d: SelectDetail<T>) => void;
    onClick?: (d: PointDetail<T>) => void;
    onDblclick?: (d: PointDetail<T>) => void;
    onHover?: (d: HoverDetail<T>) => void;
}
