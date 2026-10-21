// The server render of the harness page (build:ssr): Harness.vue with the
// default query, which entry-client-ssr.ts hydrates.
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Harness from './Harness.vue';

export function render(): Promise<string> {
    return renderToString(createSSRApp(Harness, { params: {} }));
}
