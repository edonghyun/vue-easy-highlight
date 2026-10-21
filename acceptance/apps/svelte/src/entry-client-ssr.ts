// The harness page under SSR: page set-up from the query, then
// HarnessApp.svelte hydrates the markup entry-server.ts rendered into #host.
// Svelte warns on the console when the markup's structure does not match,
// and repairs other mismatches (text among them) without a warning, which
// watchHydration catches as changed markup. Either marks the page.
import { hydrate } from 'svelte';
import HarnessApp from './HarnessApp.svelte';
import { hydratingParams, setUpPage, watchHydration } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
watchHydration(host);
hydrate(HarnessApp, {
    target: host,
    props: { params: hydratingParams(params) },
});
