// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then Harness.vue renders the fixture.
import { createApp } from 'vue';
import Harness from './Harness.vue';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
const root = document.createElement('div');
host.append(root);
createApp(Harness, { params: Object.fromEntries(params) }).mount(root);
