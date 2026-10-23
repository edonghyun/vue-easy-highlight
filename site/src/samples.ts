// The texts and highlights behind every live example on the two pages.
import type { Highlight } from '@overlapmark/core';
import { PALETTES } from './palette';

export interface Label {
    label: string;
}

export interface Sample {
    text: string;
    highlights: Highlight<Label>[];
}

type Seed = [
    id: string,
    label: string,
    from: string,
    to: string | null,
    color: string,
];

/** Highlights from `from` up to the end of `to` (or of `from`) in `text`. */
function sample(text: string, seeds: Seed[]): Sample {
    return {
        text,
        highlights: seeds.map(([id, label, from, to, color]) => {
            const start = text.indexOf(from);
            const last = text.indexOf(to ?? from, start);
            if (start < 0 || last < 0)
                throw new Error(`"${from}" not in "${text}"`);
            return {
                id,
                start,
                end: last + (to ?? from).length,
                color,
                data: { label },
            };
        }),
    };
}

const [yellow, amber, orange, coral, pink] = PALETTES.warm;
const [, sky, blue, periwinkle] = PALETTES.cool;

const LAYERS_TEXT = 'The more highlights cover a spot, the darker it gets.';

export const SAMPLES = {
    /** The demo's opening sentence, seeded with three overlapping marks. */
    hero: sample(
        'Readers mark what matters to them, and their marks overlap. Where three readers agree, the page should say so at a glance.',
        [
            ['h1', 'Reader 1', 'Readers mark', 'to them,', yellow],
            ['h2', 'Reader 2', 'what matters', 'marks overlap.', orange],
            ['h3', 'Reader 3', 'their marks', 'three readers agree,', pink],
        ],
    ),

    /** `n` (1 to 6) ranges nested toward the middle of one sentence. */
    layers(n: number): Sample {
        return {
            text: LAYERS_TEXT,
            highlights: PALETTES.mono.slice(0, n).map((color, i) => ({
                id: `l${i + 1}`,
                start: 4 + i * 3,
                end: LAYERS_TEXT.length - 1 - i * 3,
                color,
                data: { label: `Layer ${i + 1}` },
            })),
        };
    },

    /** A reader's analyses of two sentences: one cool family, one warm. */
    passage: sample(
        'Cities that plant trees along their streets tend to report cooler summers. In one survey of forty neighbourhoods, blocks with a full canopy were up to four degrees cooler at street level than bare ones.',
        [
            [
                'argument',
                'Argument',
                'Cities that plant',
                'cooler summers.',
                blue,
            ],
            ['hedge', 'Hedge', 'tend to', null, periwinkle],
            ['subject', 'Subject', 'Cities that plant trees', null, sky],
            [
                'evidence',
                'Evidence',
                'In one survey',
                'than bare ones.',
                yellow,
            ],
            [
                'comparison',
                'Comparison',
                'blocks with a full canopy',
                'than bare ones',
                orange,
            ],
            ['term', 'Key term', 'full canopy', null, pink],
        ],
    ),

    /** For the style presets. */
    styling: sample(
        'Read it once for the argument, again for the evidence, and a third time for what the author leaves out.',
        [
            ['once', 'First reading', 'Read it once', 'leaves out.', yellow],
            ['again', 'Second reading', 'again for', 'a third time', amber],
            ['third', 'Third reading', 'a third time', 'leaves out', coral],
        ],
    ),

    /** For the overlap modes. */
    modes: sample('Overlapping highlights get darker where they overlap.', [
        ['m1', 'Outer', 'Overlapping', 'they overlap', yellow],
        ['m2', 'Middle', 'highlights', 'where', orange],
        ['m3', 'Inner', 'get darker', null, pink],
    ]),
};
