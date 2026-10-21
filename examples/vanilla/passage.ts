// The demo's passage and the reader's analyses of it. Every analysis covers
// whole sentences or phrases inside them, so they nest (a key term inside a
// comparison inside the evidence inside the argument) and cross (the
// trade-off starts inside the argument and ends after it).

export const PASSAGE =
    'Cities that plant trees along their streets tend to report cooler summers. ' +
    'In one survey of forty neighbourhoods, blocks with a full canopy were up to four degrees cooler at street level than bare ones. ' +
    'The effect is not only about shade: leaves release water as they breathe, and that evaporation pulls heat out of the air. ' +
    'Critics point out that a young tree takes decades to mature, so the benefit arrives slowly. ' +
    'Still, few other measures lower the temperature, the energy bill and the noise at once.';

/** A fill per theme: multiply needs deeper colors on a dark background. */
export interface Tone {
    light: string;
    dark: string;
}

export interface Analysis {
    label: string;
    tone: Tone;
    /** Added by the visitor, so it can be renamed and removed. */
    own?: boolean;
}

interface Seed {
    id: string;
    label: string;
    from: string;
    to?: string;
    tone: Tone;
}

const SEEDS: Seed[] = [
    {
        id: 'argument',
        label: 'Argument',
        from: 'Cities that plant',
        to: 'out of the air.',
        tone: { light: '#8dbdff', dark: '#3a78e8' },
    },
    {
        id: 'hedge',
        label: 'Hedge',
        from: 'tend to',
        tone: { light: '#ffc6d9', dark: '#c45c86' },
    },
    {
        id: 'evidence',
        label: 'Evidence',
        from: 'In one survey',
        to: 'than bare ones.',
        tone: { light: '#4fd49b', dark: '#1f9e6b' },
    },
    {
        id: 'comparison',
        label: 'Comparison',
        from: 'blocks with a full canopy',
        to: 'than bare ones',
        tone: { light: '#b49bff', dark: '#8064e8' },
    },
    {
        id: 'term',
        label: 'Key term',
        from: 'full canopy',
        tone: { light: '#fff27a', dark: '#c9a800' },
    },
    {
        id: 'mechanism',
        label: 'Mechanism',
        from: 'The effect is',
        to: 'out of the air.',
        tone: { light: '#3fcfe0', dark: '#14919e' },
    },
    {
        id: 'tradeoff',
        label: 'Trade-off',
        from: 'that evaporation',
        to: 'arrives slowly.',
        tone: { light: '#ffa64d', dark: '#d9761c' },
    },
    {
        id: 'objection',
        label: 'Objection',
        from: 'Critics point out',
        to: 'arrives slowly.',
        tone: { light: '#ff7a7a', dark: '#d2453b' },
    },
    {
        id: 'conclusion',
        label: 'Conclusion',
        from: 'Still, few',
        to: 'at once.',
        tone: { light: '#b5e550', dark: '#7da622' },
    },
];

/** `[start, end)` of the passage from the start of `from` to the end of `to`. */
function range(from: string, to = from): { start: number; end: number } {
    const start = PASSAGE.indexOf(from);
    const last = PASSAGE.indexOf(to, start);
    if (start < 0 || last < 0) throw new Error(`"${from}" not in the passage`);
    return { start, end: last + to.length };
}

export interface AnalysisRange {
    id: string;
    start: number;
    end: number;
    data: Analysis;
}

export function seedAnalyses(): AnalysisRange[] {
    return SEEDS.map(({ id, label, from, to, tone }) => ({
        id,
        ...range(from, to),
        data: { label, tone },
    }));
}

/** A fresh, well-spread hue for the visitor's n-th analysis. */
export function ownTone(n: number): Tone {
    const hue = Math.round((n * 137.5 + 200) % 360);
    return {
        light: `hsl(${hue} 90% 72%)`,
        dark: `hsl(${hue} 62% 44%)`,
    };
}
