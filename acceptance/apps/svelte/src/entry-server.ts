// The server render of the harness page (build:ssr): HarnessApp.svelte with
// the default query, which entry-client-ssr.ts hydrates.
import { render as renderOnServer } from 'svelte/server';
import HarnessApp from './HarnessApp.svelte';

export function render(): string {
    return renderOnServer(HarnessApp, { props: { params: {} } }).body;
}
