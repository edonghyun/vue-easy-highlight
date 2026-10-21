import type { Highlight, Segment } from './types';
import { warnOnce } from './warn';

/**
 * Highlight order (spec 4.3): start ascending, length descending, then input order.
 */
export function compareHighlights(
    a: Highlight,
    b: Highlight,
    indexOf: (h: Highlight) => number,
): number {
    if (a.start !== b.start) return a.start - b.start;
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (la !== lb) return lb - la;
    return indexOf(a) - indexOf(b);
}

function isHigh(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
}

function isLow(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
}

interface Entry<T> {
    source: Highlight<T>;
    start: number;
    end: number;
    index: number;
    rank: number;
}

function normalize<T>(
    text: string,
    highlights: readonly Highlight<T>[],
): Entry<T>[] {
    const len = text.length;
    const entries: Entry<T>[] = [];
    const ids = new Set<string>();
    highlights.forEach((h, index) => {
        if (ids.has(h.id)) {
            warnOnce(`Duplicate highlight id "${h.id}"`);
        }
        ids.add(h.id);
        if (!Number.isInteger(h.start) || !Number.isInteger(h.end)) {
            warnOnce(`Highlight "${h.id}" has a non-integer range; dropped`);
            return;
        }
        let start = Math.max(0, Math.min(h.start, len));
        let end = Math.max(0, Math.min(h.end, len));
        if (start !== h.start || end !== h.end) {
            warnOnce(
                `Highlight "${h.id}" range [${h.start}, ${h.end}) clamped to text length ${len}`,
            );
        }
        if (start >= end) {
            warnOnce(
                `Highlight "${h.id}" range [${h.start}, ${h.end}) is empty or reversed; dropped`,
            );
            return;
        }
        if (
            start > 0 &&
            isLow(text.charCodeAt(start)) &&
            isHigh(text.charCodeAt(start - 1))
        ) {
            start -= 1;
        }
        if (
            end < len &&
            isLow(text.charCodeAt(end)) &&
            isHigh(text.charCodeAt(end - 1))
        ) {
            end += 1;
        }
        entries.push({ source: h, start, end, index, rank: 0 });
    });
    return entries;
}

/** Canonical rank of each entry of `segment.highlights`, recorded by computeSegments. */
const segmentRanks = new WeakMap<object, number[]>();

export function computeSegments<T>(
    text: string,
    highlights: readonly Highlight<T>[],
): Segment<T>[] {
    const len = text.length;
    if (len === 0) return [];

    const entries = normalize(text, highlights);

    // Rank entries once by the canonical order, using the normalized ranges.
    const byIndex = new Map<Highlight, number>();
    const proxies = entries.map((e) => {
        const proxy: Highlight = {
            id: e.source.id,
            start: e.start,
            end: e.end,
        };
        byIndex.set(proxy, e.index);
        return proxy;
    });
    const order = entries.map((_, i) => i);
    order.sort((x, y) =>
        compareHighlights(
            proxies[x],
            proxies[y],
            (h) => byIndex.get(h) as number,
        ),
    );
    const byRank: Entry<T>[] = order.map((i, rank) => {
        entries[i].rank = rank;
        return entries[i];
    });

    interface Event {
        pos: number;
        add: boolean;
        rank: number;
    }
    const events: Event[] = [];
    for (const e of byRank) {
        events.push({ pos: e.start, add: true, rank: e.rank });
        events.push({ pos: e.end, add: false, rank: e.rank });
    }
    events.sort((a, b) => a.pos - b.pos);

    const segments: Segment<T>[] = [];
    const active: number[] = []; // sorted ranks
    let cursor = 0;

    const emit = (end: number): void => {
        const segment: Segment<T> = {
            start: cursor,
            end,
            text: text.slice(cursor, end),
            highlights: active.map((r) => byRank[r].source),
            depth: active.length,
        };
        segmentRanks.set(segment, active.slice());
        segments.push(segment);
    };

    for (const ev of events) {
        if (ev.pos > cursor) {
            emit(ev.pos);
            cursor = ev.pos;
        }
        if (ev.add) {
            let lo = 0;
            let hi = active.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (active[mid] < ev.rank) lo = mid + 1;
                else hi = mid;
            }
            active.splice(lo, 0, ev.rank);
        } else {
            active.splice(active.indexOf(ev.rank), 1);
        }
    }
    if (cursor < len) emit(len);
    return segments;
}

/** Binary search for the segment with `start <= offset < end`. */
export function segmentAt<T>(
    segments: readonly Segment<T>[],
    offset: number,
): Segment<T> | undefined {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const s = segments[mid];
        if (offset < s.start) hi = mid - 1;
        else if (offset >= s.end) lo = mid + 1;
        else return s;
    }
    return undefined;
}

/** Highlights overlapping [start, end), de-duplicated, in highlight order. */
export function highlightsInRange<T>(
    segments: readonly Segment<T>[],
    start: number,
    end: number,
): Highlight<T>[] {
    if (start >= end || segments.length === 0) return [];
    // first segment whose end > start
    let lo = 0;
    let hi = segments.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (segments[mid].end <= start) lo = mid + 1;
        else hi = mid;
    }
    // Order by the canonical rank computeSegments assigned (normalized ranges),
    // not by the raw start/end the caller passed in.
    const best = new Map<Highlight<T>, number>();
    let fallback = Number.MAX_SAFE_INTEGER / 2;
    for (let i = lo; i < segments.length && segments[i].start < end; i++) {
        const ranks = segmentRanks.get(segments[i]);
        segments[i].highlights.forEach((h, j) => {
            // Hand-built segments carry no rank: keep their listed order after ranked ones.
            const rank = ranks ? ranks[j] : fallback++;
            const prev = best.get(h);
            if (prev === undefined || rank < prev) best.set(h, rank);
        });
    }
    return [...best.entries()].sort((a, b) => a[1] - b[1]).map(([h]) => h);
}
