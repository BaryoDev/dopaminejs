// The script tag file `dist/dopamine.all.global.js`: the main entry, celebrate,
// the certificate and auto in one file. It is not an `exports` entry.
import { createDopamine } from './index.js';
import { auto } from './auto.js';

export * from './index.js';
export { celebrate, destroyCelebrations } from './celebrate.js';
export { showCertificate, destroyCertificate } from './certificate.js';
export { auto, destroyAuto } from './auto.js';

// `<script src=".../dopamine.all.global.js" data-dopamine-auto>` wires the page.
// Without the attribute, loading the file changes nothing.
const script = typeof document === 'undefined' ? null : document.currentScript;
if (script && script.hasAttribute('data-dopamine-auto')) {
    // createDopamine() appends to the body, and a script in <head> without
    // defer runs before the body exists.
    const start = () => auto({ host: createDopamine() });
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
}
