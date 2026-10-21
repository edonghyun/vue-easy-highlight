// The type tests in test/types/, checked by the TypeScript compiler with the
// package's own options, as a consumer's code is.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { typeErrorsIn } from '../../../type-errors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const misusedOption = `
    import { createHighlighter } from '../../src';

    createHighlighter(document.body, { text: 42 });
`;

// Each check type-checks a whole program: seconds each.
const typeCheckTimeout = 30_000;

describe('createHighlighter types', () => {
    it(
        'type highlight data in event details, decorate and describe from the highlights',
        () => {
            const errors = typeErrorsIn(root, 'typed-data.ts');

            expect(errors).toEqual([]);
        },
        typeCheckTimeout,
    );

    it(
        'reject an option of the wrong type where it is passed',
        () => {
            const errors = typeErrorsIn(
                root,
                'misused-option.ts',
                misusedOption,
            );

            expect(errors).toContainEqual(
                expect.stringMatching(/^test\/types\/misused-option\.ts: /),
            );
        },
        typeCheckTimeout,
    );
});
