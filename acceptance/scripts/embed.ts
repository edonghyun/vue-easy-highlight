// The `embed` harness parameter, shared by every app's harness: where the
// component is mounted. Without it, in `#host` itself; with `shadow`, in an
// open shadow root on `#host`; with `iframe`, in the document of an iframe
// (`#frame`) inside `#host`. The event log and the update controls stay in
// the page. The page's stylesheets are copied to wherever the component goes,
// since neither a shadow root nor an iframe sees them.

/** The element to mount the component in, for `embed`. */
export function embeddedHost(host: HTMLElement, embed: string | null): Element {
    if (embed === 'shadow') {
        const shadow = host.attachShadow({ mode: 'open' });
        const inner = document.createElement('div');
        shadow.append(...stylesheetsFor(document), inner);
        return inner;
    }
    if (embed === 'iframe') {
        const frame = document.createElement('iframe');
        frame.id = 'frame';
        frame.title = 'embedded harness';
        frame.style.cssText =
            'display: block; width: 100%; height: 12em; border: 0';
        host.append(frame);
        // Written, not loaded: the document is ready once this returns.
        const doc = frame.contentDocument!;
        doc.open();
        doc.write('<!doctype html><html><head></head><body></body></html>');
        doc.close();
        doc.head.append(...stylesheetsFor(doc));
        return doc.body;
    }
    return host;
}

/** Copies of the page's `<style>` and stylesheet `<link>` elements, for `doc`. */
function stylesheetsFor(doc: Document): Node[] {
    return [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(
        (sheet) => doc.importNode(sheet, true),
    );
}
