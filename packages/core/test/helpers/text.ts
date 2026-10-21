// Shared node-test helpers for text and Unicode properties.
import fc from 'fast-check';

/** Short texts mixing arbitrary graphemes with emoji, Hangul, combining marks and CRLF. */
export const textArb = fc
    .array(
        fc.oneof(
            fc.string({ unit: 'grapheme', maxLength: 4 }),
            fc.constantFrom('😀', '한글', '👨‍👩‍👧', 'é', '\r\n', '🏳️‍🌈'),
        ),
        { maxLength: 12 },
    )
    .map((parts) => parts.join(''));

/**
 * Every UTF-16 index of `text` that starts a code point, plus `text.length`.
 * Derived from string iteration rather than surrogate code-unit ranges, so it
 * serves as an oracle independent of src/unicode.ts.
 */
export function codePointBoundaries(text: string): number[] {
    const bounds = [0];
    let i = 0;
    for (const ch of text) {
        i += ch.length;
        bounds.push(i);
    }
    return bounds;
}

/** Matches a high surrogate without a low one after it, or a low one without a high one before it. */
export const LONE_SURROGATE =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
