import { describe, test } from 'vitest';
import { computeSegments } from '../src/index';
import { segmentsDataset } from './dataset';

const { text, highlights } = segmentsDataset();

describe('computeSegments', () => {
    test('100k chars, 1000 highlights (len 5-500)', async ({ bench }) => {
        await bench('computeSegments', () => {
            computeSegments(text, highlights);
        }).run();
    });
});
