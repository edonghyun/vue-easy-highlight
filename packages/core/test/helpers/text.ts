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

/** Matches a high surrogate without a low one after it, or a low one without a high one before it. */
export const LONE_SURROGATE =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
