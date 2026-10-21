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

export interface Analysis {
    label: string;
    color: string;
    /** Added by the visitor, so it can be renamed and removed. */
    own?: boolean;
}

interface Seed {
    id: string;
    label: string;
    from: string;
    to?: string;
    color: string;
}

const SEEDS: Seed[] = [
    {
        id: 'argument',
        label: 'Argument',
        from: 'Cities that plant',
        to: 'out of the air.',
        color: '#8dbdff',
    },
    {
        id: 'hedge',
        label: 'Hedge',
        from: 'tend to',
        color: '#ffc6d9',
    },
    {
        id: 'evidence',
        label: 'Evidence',
        from: 'In one survey',
        to: 'than bare ones.',
        color: '#4fd49b',
    },
    {
        id: 'comparison',
        label: 'Comparison',
        from: 'blocks with a full canopy',
        to: 'than bare ones',
        color: '#b49bff',
    },
    {
        id: 'term',
        label: 'Key term',
        from: 'full canopy',
        color: '#fff27a',
    },
    {
        id: 'mechanism',
        label: 'Mechanism',
        from: 'The effect is',
        to: 'out of the air.',
        color: '#3fcfe0',
    },
    {
        id: 'tradeoff',
        label: 'Trade-off',
        from: 'that evaporation',
        to: 'arrives slowly.',
        color: '#ffa64d',
    },
    {
        id: 'objection',
        label: 'Objection',
        from: 'Critics point out',
        to: 'arrives slowly.',
        color: '#ff7a7a',
    },
    {
        id: 'conclusion',
        label: 'Conclusion',
        from: 'Still, few',
        to: 'at once.',
        color: '#b5e550',
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
    return SEEDS.map(({ id, label, from, to, color }) => ({
        id,
        ...range(from, to),
        data: { label, color },
    }));
}

/** A fresh, well-spread hue for the visitor's n-th analysis. */
export function ownColor(n: number): string {
    return `hsl(${Math.round((n * 137.5 + 200) % 360)} 90% 72%)`;
}
