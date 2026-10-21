import { warnOnce } from './warn';

/** The longest color value accepted; real colors are far shorter. */
const MAX_LENGTH = 64;

/** Characters and functions that let a value end its declaration or fetch something. */
const UNSAFE = /[;{}<>\\]|url\(|expression\(/i;

/**
 * `value` when it is a string safe to put in a style declaration, otherwise
 * `undefined`: silently for a value that is not a string (an absent
 * `null` or `undefined` among them), with a dev warning for an unsafe one. A highlight color goes into a style
 * attribute, on the server as a string, so a value that could end its
 * declaration or open a rule would inject CSS.
 */
export function safeColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    if (value.length > MAX_LENGTH || UNSAFE.test(value)) {
        warnOnce(
            `ignoring unsafe highlight color ${JSON.stringify(value.slice(0, MAX_LENGTH))}`,
        );
        return undefined;
    }
    return value;
}
