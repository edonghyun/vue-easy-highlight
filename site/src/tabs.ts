export interface TabEntry {
    label: string;
    lang: string;
    code: string;
}

/**
 * A code block with one tab per entry: a `.bar` of `role="tab"` buttons over
 * a `<pre>`. The first entry is selected.
 */
export function mountTabs(
    host: HTMLElement,
    entries: readonly TabEntry[],
): void {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const list = document.createElement('div');
    list.className = 'seg';
    list.setAttribute('role', 'tablist');
    const lang = document.createElement('span');
    lang.className = 'mono';
    bar.append(list, lang);
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    pre.append(code);
    pre.tabIndex = 0;

    const buttons = entries.map((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.textContent = entry.label;
        button.addEventListener('click', () => select(entry, button));
        list.append(button);
        return button;
    });

    function select(entry: TabEntry, button: HTMLButtonElement): void {
        for (const b of buttons)
            b.setAttribute('aria-selected', String(b === button));
        code.textContent = entry.code;
        lang.textContent = entry.lang;
    }

    host.classList.add('card');
    host.replaceChildren(bar, pre);
    if (entries[0]) select(entries[0], buttons[0]!);
}
