// The README quick start, mounted on #text.
import { mount } from 'svelte';
import QuickStart from './QuickStart.svelte';

mount(QuickStart, { target: document.getElementById('text')! });
