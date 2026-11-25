/**
 * Puts an icon into an element. Shared by RewardUI and the certificate, so the
 * sanitiser is one copy. Nothing here runs at import time.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_ELEMENTS = new Set([
    'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline',
    'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'linearGradient',
    'radialGradient', 'stop', 'clipPath', 'mask'
]);

// No style, no href, no event handlers: only geometry and paint.
const SVG_ATTRIBUTES = new Set([
    'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy',
    'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-opacity',
    'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-opacity', 'opacity', 'offset', 'stop-color', 'stop-opacity',
    'gradientUnits', 'gradientTransform', 'clip-path', 'mask', 'clip-rule',
    'font-size', 'font-family', 'font-weight', 'text-anchor', 'id',
    'aria-hidden', 'aria-label', 'role'
]);

// Attributes that may point at a gradient, clip path or mask in the same icon.
const REFERENCE_ATTRIBUTES = new Set(['fill', 'stroke', 'clip-path', 'mask']);
const TRANSFORM_ATTRIBUTES = new Set(['transform', 'gradientTransform']);

const SINGLE_FRAGMENT_URL = /^url\(\s*#([A-Za-z][\w.:-]*)\s*\)$/;
const PLAIN_COLOUR = /^[#a-zA-Z0-9(),.%\s-]+$/;
const PLAIN_TRANSFORM = /^[a-zA-Z0-9(),.\s-]+$/;
const SAFE_ID = /^[A-Za-z][\w.:-]*$/;

// Ids inside an icon are page-global (window.<id>, getElementById), so every
// render gets its own prefix.
let iconCounter = 0;

function collectIds(node, ids) {
    if (node.nodeType !== 1 || node.namespaceURI !== SVG_NS || !SVG_ELEMENTS.has(node.localName)) {
        return;
    }
    const id = node.getAttribute('id');
    if (id && SAFE_ID.test(id)) ids.add(id);
    for (const child of Array.from(node.childNodes)) collectIds(child, ids);
}

/**
 * Returns the value to write, or null to drop the attribute.
 */
function cleanValue(name, value, ctx) {
    if (value.includes('\\')) return null;
    const trimmed = value.trim();

    if (name === 'id') {
        return SAFE_ID.test(trimmed) ? ctx.prefix + trimmed : null;
    }

    if (REFERENCE_ATTRIBUTES.has(name)) {
        const ref = SINGLE_FRAGMENT_URL.exec(trimmed);
        if (ref) {
            return ctx.ids.has(ref[1]) ? `url(#${ctx.prefix}${ref[1]})` : null;
        }
        return PLAIN_COLOUR.test(trimmed) && !/url/i.test(trimmed) ? trimmed : null;
    }

    if (TRANSFORM_ATTRIBUTES.has(name)) {
        return PLAIN_TRANSFORM.test(trimmed) && !/url/i.test(trimmed) ? trimmed : null;
    }

    if (value.includes('(')) {
        // Only a plain colour such as rgb() or hsl() is acceptable here.
        return name === 'stop-color' && PLAIN_COLOUR.test(trimmed) && !/url/i.test(trimmed)
            ? trimmed
            : null;
    }
    return value;
}

function cleanNode(source, ctx) {
    // 3 is text, 4 is CDATA.
    if (source.nodeType === 3 || source.nodeType === 4) {
        return document.createTextNode(source.data);
    }
    if (source.nodeType !== 1
        || source.namespaceURI !== SVG_NS
        || !SVG_ELEMENTS.has(source.localName)) {
        return null;
    }

    const clean = document.createElementNS(SVG_NS, source.localName);
    for (const attr of Array.from(source.attributes)) {
        if (attr.namespaceURI !== null || !SVG_ATTRIBUTES.has(attr.name)) continue;
        const value = cleanValue(attr.name, attr.value, ctx);
        if (value !== null) clean.setAttribute(attr.name, value);
    }
    for (const child of Array.from(source.childNodes)) {
        const kept = cleanNode(child, ctx);
        if (kept) clean.appendChild(kept);
    }
    return clean;
}

/**
 * Parse a string as SVG and rebuild it from an allowlist of elements and
 * attributes, so nothing that can run script or load a resource survives.
 * Returns null unless the whole string is one valid <svg> document.
 */
function parseSafeSvg(markup) {
    let doc;
    // Inline HTML SVG usually has no xmlns, which the XML parser rejects.
    const source = /^\s*<svg[\s>]/.test(markup) && !/^\s*<svg\b[^>]*\sxmlns\s*=/.test(markup)
        ? markup.replace(/^(\s*<svg)/, `$1 xmlns="${SVG_NS}"`)
        : markup;
    try {
        doc = new DOMParser().parseFromString(source,'image/svg+xml');
    } catch {
        return null;
    }
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
        return null;
    }
    const ids = new Set();
    collectIds(root, ids);
    return cleanNode(root, { ids, prefix: `dj-icon-${++iconCounter}-` });
}

/**
 * Single place where icons reach the DOM. A Node is appended. A string is a
 * sanitised SVG or plain text unless safeIcons is off; then it is HTML (see
 * SECURITY.md).
 */
export function setIcon(el, icon, safeIcons) {
    el.textContent = '';
    if (typeof Node !== 'undefined' && icon instanceof Node) {
        el.appendChild(icon);
    } else if (typeof icon !== 'string') {
        return;
    } else if (!safeIcons) {
        el.innerHTML = icon;
    } else {
        const svg = parseSafeSvg(icon);
        if (svg) {
            el.appendChild(svg);
        } else {
            el.textContent = icon;
        }
    }
}
