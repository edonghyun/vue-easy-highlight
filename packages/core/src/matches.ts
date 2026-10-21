import { codePointLengthAt, codePointLengthBefore } from './unicode';

export interface FindMatchesOptions {
    caseSensitive?: boolean;
    overlapping?: boolean;
    wholeWord?: boolean;
}

const WORD_CHAR = /^[\p{L}\p{N}_]$/u;

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function charBefore(text: string, index: number): string {
    if (index <= 0) return '';
    return text.slice(index - codePointLengthBefore(text, index), index);
}

function charAfter(text: string, index: number): string {
    if (index >= text.length) return '';
    return text.slice(index, index + codePointLengthAt(text, index));
}

function isWordChar(ch: string): boolean {
    return ch !== '' && WORD_CHAR.test(ch);
}

/**
 * Finds literal occurrences of the query/queries in text. Returned ranges are
 * UTF-16 indices (end exclusive), never split surrogate pairs, and are sorted
 * by start then end. Identical ranges from different queries are deduplicated.
 */
export function findMatches(
    text: string,
    query: string | readonly string[],
    options: FindMatchesOptions = {},
): { start: number; end: number }[] {
    const {
        caseSensitive = false,
        overlapping = true,
        wholeWord = false,
    } = options;
    const queries = typeof query === 'string' ? [query] : query;
    const seen = new Set<string>();
    const result: { start: number; end: number }[] = [];

    for (const q of new Set(queries)) {
        if (!q) continue;
        const re = new RegExp(escapeRegExp(q), caseSensitive ? 'gu' : 'giu');
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            const ok =
                !wholeWord ||
                (!isWordChar(charBefore(text, start)) &&
                    !isWordChar(charAfter(text, end)));
            if (ok) {
                const key = `${start}:${end}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push({ start, end });
                }
            }
            if (ok && !overlapping) {
                re.lastIndex = end;
            } else {
                // advance one code point so we never land inside a surrogate pair
                re.lastIndex = start + codePointLengthAt(text, start);
            }
        }
    }

    return result.sort((a, b) => a.start - b.start || a.end - b.end);
}
