const seen = new Set<string>();

/**
 * Dev mode unless NODE_ENV is 'production'. Bundlers statically replace
 * `process.env.NODE_ENV` (so this folds to a constant in browser builds);
 * where neither the replacement nor a `process` global exists, the access
 * throws and we stay silent.
 */
function isDev(): boolean {
    try {
        return process.env.NODE_ENV !== 'production';
    } catch {
        return false;
    }
}

/** Dev-only console.warn, emitted once per distinct message. */
export function warnOnce(message: string): void {
    if (!isDev()) {
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
