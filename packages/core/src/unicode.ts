/**
 * UTF-16 surrogate-pair rules. Every offset the library returns or accepts is
 * a UTF-16 index that must never fall between the two halves of a pair; this
 * module is the single owner of how that is decided. Internal, not exported
 * from the package entry points.
 */

export function isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
}

export function isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
}

/** True when index `i` falls between the two halves of a surrogate pair. */
export function isInsidePair(text: string, i: number): boolean {
    return (
        i > 0 &&
        i < text.length &&
        isLowSurrogate(text.charCodeAt(i)) &&
        isHighSurrogate(text.charCodeAt(i - 1))
    );
}

/** UTF-16 length (1 or 2) of the code point that starts at index `i`. */
export function codePointLengthAt(text: string, i: number): number {
    return isInsidePair(text, i + 1) ? 2 : 1;
}

/** UTF-16 length (1 or 2) of the code point that ends at index `i`. */
export function codePointLengthBefore(text: string, i: number): number {
    return isInsidePair(text, i - 1) ? 2 : 1;
}
