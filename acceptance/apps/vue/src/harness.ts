// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then Harness.vue renders the fixture.
import { createApp } from 'vue';
import Harness from './Harness.vue';
import { embeddedHost } from '../../../scripts/embed';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = embeddedHost(setUpPage(params), params.get('embed'));
const root = host.ownerDocument.createElement('div');
host.append(root);
createApp(Harness, { params: Object.fromEntries(params) }).mount(root);
