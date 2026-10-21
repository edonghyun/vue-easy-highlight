// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then HarnessApp renders the fixture.
import { createRoot } from 'react-dom/client';
import { HarnessApp } from './HarnessApp';
import { embeddedHost } from '../../../scripts/embed';
import { setUpPage } from './page';

const params = new URLSearchParams(location.search);

const host = embeddedHost(setUpPage(params), params.get('embed'));
const root = host.ownerDocument.createElement('div');
host.append(root);
createRoot(root).render(<HarnessApp params={Object.fromEntries(params)} />);
