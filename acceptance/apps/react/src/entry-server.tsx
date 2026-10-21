// The server render of the harness page (build:ssr): HarnessApp with the
// default query, which entry-client-ssr.tsx hydrates.
import { renderToString } from 'react-dom/server';
import { HarnessApp } from './HarnessApp';

export function render(): string {
    return renderToString(<HarnessApp params={{}} />);
}
