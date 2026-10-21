// The harness page under SSR: page set-up from the query, then HarnessApp
// hydrates the markup entry-server.tsx rendered into #host. Errors React
// recovers from (hydration mismatches among them) and console warnings and
// errors mark the page.
import { hydrateRoot } from 'react-dom/client';
import { HarnessApp } from './HarnessApp';
import { hydratingParams, setUpPage, watchHydration } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
const flag = watchHydration(host);
hydrateRoot(host, <HarnessApp params={hydratingParams(params)} />, {
    onRecoverableError: (error) => flag(String(error)),
});
