import { describe, expect, it } from 'vitest';
import * as core from '../src/index';

describe('package entry', () => {
    it('loads', () => {
        expect(core).toBeTypeOf('object');
    });
});
