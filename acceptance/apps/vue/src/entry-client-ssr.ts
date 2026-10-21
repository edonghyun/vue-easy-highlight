// The harness page under SSR: page set-up from the query, then Harness.vue
// hydrates the markup entry-server.ts rendered into #host. Vue's warnings
// (hydration mismatches among them) and console errors mark the page.
import { createSSRApp } from 'vue';
import Harness from './Harness.vue';
import { hydratingParams, setUpPage, watchHydration } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
const flag = watchHydration(host);
const app = createSSRApp(Harness, { params: hydratingParams(params) });
app.config.warnHandler = (message) => flag(message);
app.mount(host);
