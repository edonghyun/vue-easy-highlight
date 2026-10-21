// The type tests in test/types/, checked by the TypeScript compiler with the
// package's own options, as a consumer's code is.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { typeErrorsIn } from '../../../type-errors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const misusedProp = `
    import { Highlighter } from '../../src';

    <Highlighter text={42} />;
`;

// Each check type-checks a whole program, React's types included: seconds each.
const typeCheckTimeout = 30_000;

describe('Highlighter types', () => {
    it(
        'type highlight data in event details, the decoration and describe from the highlights',
        () => {
            const errors = typeErrorsIn(root, 'typed-data.tsx');

            expect(errors).toEqual([]);
        },
        typeCheckTimeout,
    );

    it(
        'reject a prop of the wrong type where it is passed',
        () => {
            const errors = typeErrorsIn(root, 'misused-prop.tsx', misusedProp);

            expect(errors).toContainEqual(
                expect.stringMatching(/^test\/types\/misused-prop\.tsx: /),
            );
        },
        typeCheckTimeout,
    );
});
