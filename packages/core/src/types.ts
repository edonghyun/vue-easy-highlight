export interface Highlight<T = unknown> {
    id: string;
    start: number;
    end: number;
    className?: string;
    color?: string;
    data?: T;
}

export interface Segment<T = unknown> {
    start: number;
    end: number;
    text: string;
    highlights: Highlight<T>[];
    depth: number;
}
