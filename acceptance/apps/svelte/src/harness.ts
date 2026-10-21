// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then HarnessApp.svelte renders the fixture.
import { mount } from 'svelte';
import HarnessApp from './HarnessApp.svelte';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
const root = document.createElement('div');
host.append(root);
mount(HarnessApp, {
    target: root,
    props: { params: Object.fromEntries(params) },
});
