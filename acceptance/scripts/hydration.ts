// The hydration verdict of the SSR harness pages (the `ssr` variant), shared
// by the Vue, React and Svelte apps' entry-client-ssr. Each app wires its
// framework's own hook to the function watchHydration returns.

/**
 * Marks `body[data-hydration-issue]` with the first hydration issue: a
 * message passed to the returned function, one written to `console.warn` or
 * `console.error` (the channels the frameworks report mismatches on), or a
 * change to the server's markup in `host` before the harness is ready. A
 * client that takes the markup over changes none of it, but a framework may
 * repair a mismatch without a warning (Svelte does, for text).
 */
export function watchHydration(host: HTMLElement): (message: string) => void {
    const flag = (message: string): void => {
        document.body.dataset.hydrationIssue ??= message;
    };
    for (const level of ['warn', 'error'] as const) {
        const write = console[level];
        console[level] = (...args: unknown[]) => {
            flag(args.map(String).join(' '));
            write.apply(console, args);
        };
    }
    const observer = new MutationObserver((records) => {
        for (const { target, type } of records) {
            if (target === document.body) return observer.disconnect();
            flag(
                `hydration changed the server markup: ${type} in ${target.nodeName}`,
            );
        }
    });
    observer.observe(host, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    observer.observe(document.body, {
        attributeFilter: ['data-harness-ready'],
    });
    return flag;
}

/**
 * The query the hydrating client renders. The server rendered the default
 * one; `mismatch=1` makes the client render another fixture's text, the live
 * control for `data-hydration-issue`.
 */
export function hydratingParams(
    params: URLSearchParams,
): Record<string, string> {
    const query = Object.fromEntries(params);
    return query.mismatch === '1' ? { ...query, fixture: 'unicode' } : query;
}
