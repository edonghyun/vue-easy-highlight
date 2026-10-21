// The browser command that renders ServerView the way a server does: in
// Node, compiled for the server by vite-plugin-svelte (through the test
// project's Vite server), with svelte/server's `render`. A component compiled
// for the browser cannot be server-rendered, so the browser SSR tests ask
// Node for the markup instead of rendering it themselves.
//
// It relies on Vite's `server.ssrLoadModule` (exposed as `project.vite`),
// written against Vitest 5.0.5 and Vite 8.3.4. Vite's Environment API is the newer
// way to load server modules; if a Vite major drops `ssrLoadModule`, load
// ServerView through the SSR environment's module runner instead.
import { fileURLToPath } from 'node:url';
import type { BrowserCommand } from 'vitest/node';
import type { ServerViewProps } from './server-view.ts';

declare module 'vitest/browser' {
    interface BrowserCommands {
        /** The server-rendered body of ServerView with `props`. */
        renderOnServer: (props: ServerViewProps) => Promise<string>;
    }
}

const serverView = fileURLToPath(
    new URL('./ServerView.svelte', import.meta.url),
);

export const renderOnServer: BrowserCommand<[ServerViewProps], string> = async (
    { project },
    props,
) => {
    const { render } = await project.vite.ssrLoadModule('svelte/server');
    const { default: ServerView } =
        await project.vite.ssrLoadModule(serverView);
    return render(ServerView, { props }).body;
};
