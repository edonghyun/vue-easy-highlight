// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then HarnessApp renders the fixture.
import { createRoot } from 'react-dom/client';
import { HarnessApp } from './HarnessApp';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = setUpPage(params);
const root = document.createElement('div');
host.append(root);
createRoot(root).render(<HarnessApp params={Object.fromEntries(params)} />);
