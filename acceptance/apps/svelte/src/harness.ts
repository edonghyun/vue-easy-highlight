// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then HarnessApp.svelte renders the fixture.
import { mount } from 'svelte';
import HarnessApp from './HarnessApp.svelte';
import { embeddedHost } from '../../../scripts/embed';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = embeddedHost(setUpPage(params), params.get('embed'));
const root = host.ownerDocument.createElement('div');
host.append(root);
mount(HarnessApp, {
    target: root,
    props: { params: Object.fromEntries(params) },
});
