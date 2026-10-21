/**
 * A box whose `value` is `$state.raw`: assigning a new value re-renders every
 * reader, and the value itself is never wrapped in a state proxy, so the
 * objects put in arrive in the component as they are.
 */
export function rawState<T>(initial: T): { value: T } {
    let value = $state.raw(initial);
    return {
        get value() {
            return value;
        },
        set value(next) {
            value = next;
        },
    };
}

/**
 * `initial` as deep `$state`, the way a Svelte caller usually holds a list:
 * a proxy whose changes made in place (a push, a new `end`) are reactive.
 */
export function deepState<T>(initial: T): T {
    const value = $state(initial);
    return value;
}
