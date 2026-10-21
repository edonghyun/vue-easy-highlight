// The README quick start, mounted on #text.
import { createRoot } from 'react-dom/client';
import { Article } from './QuickStart';

createRoot(document.getElementById('text')!).render(
    <Article text="Overlapping highlights get darker where they overlap." />,
);
