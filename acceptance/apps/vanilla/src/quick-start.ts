import '@overlapmark/core/styles.css';
import { createHighlighter } from '@overlapmark/dom';

const text = 'Overlapping highlights get darker where they overlap.';
let highlights = [{ id: 'a', start: 0, end: 20 }];

const hl = createHighlighter(document.getElementById('text')!, {
    text,
    highlights,
});

hl.on('select', ({ start, end }) => {
    highlights = [...highlights, { id: crypto.randomUUID(), start, end }];
    hl.update({ highlights });
});
hl.on('click', ({ highlights: covering }) =>
    console.log(
        'covered by',
        covering.map((h) => h.id),
    ),
);
