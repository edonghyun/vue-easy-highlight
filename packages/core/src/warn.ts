const seen = new Set<string>();

/** Dev-only console.warn, emitted once per distinct message. */
export function warnOnce(message: string): void {
    if (
        typeof process === 'undefined' ||
        process.env.NODE_ENV === 'production'
    ) {
        return;
    }
    if (seen.has(message)) {
        return;
    }
    seen.add(message);
    console.warn(`[overlapmark] ${message}`);
}

/** @internal test-only: forget which messages were already emitted. */
export function resetWarnings(): void {
    seen.clear();
}
