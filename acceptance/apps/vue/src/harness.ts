// The harness page contract (acceptance/harness-contract): page set-up from
// the query, then Harness.vue renders the fixture.
import { createApp } from 'vue';
import Harness from './Harness.vue';

const params = new URLSearchParams(location.search);

const host = document.getElementById('host')!;
const width = params.get('width');
if (width) host.style.width = `${width}px`;
if (params.get('scroll') === '1') {
    const scroller = document.createElement('div');
    scroller.id = 'scroller';
    scroller.style.height = '200px';
    scroller.style.overflow = 'auto';
    host.replaceWith(scroller);
    scroller.append(host);
}
if (params.get('css') === 'default-color') {
    const style = document.createElement('style');
    style.textContent = '#host .om-root { --om-default-color: rgb(255, 0, 0) }';
    document.head.append(style);
}

const root = document.createElement('div');
host.append(root);
createApp(Harness, { params: Object.fromEntries(params) }).mount(root);
