// The harness page set-up from the query, shared by the entry that mounts
// (harness.*) and the one that hydrates (entry-client-ssr.*).

/** Applies `width`, `scroll`, `bg` and `css` from `params`; returns `#host`. */
export function setUpPage(params: URLSearchParams): HTMLElement {
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
    if (params.get('bg') === '1') {
        const tinted = document.createElement('div');
        tinted.id = 'tinted';
        tinted.style.background = '#e7f5ff';
        tinted.style.padding = '12px';
        host.replaceWith(tinted);
        tinted.append(host);
    }
    if (params.get('css') === 'default-color') {
        const style = document.createElement('style');
        style.textContent =
            '#host .om-root { --om-default-color: rgb(255, 0, 0) }';
        document.head.append(style);
    }
    return host;
}
