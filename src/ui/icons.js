/**
 * icons.js — Professional CAD-style SVG icon library (Lucide-inspired).
 * All icons share a consistent grid (24×24), stroke 1.6px, rounded caps/joins.
 * Usage:
 *   import { icon } from './icons.js';
 *   element.innerHTML = icon('move');
 *   element.innerHTML = icon('save', 18, { color: '#fff', cls: 'my-cls' });
 */

const PATHS = {
  // ── POINTERS / TRANSFORM ─────────────────────────────
  pointer:    '<path d="M7 4.5l5.3 12.7 1.9-4.1 4.2-1.9z"/>',
  move:       '<path d="M12 3v18M3 12h18M5 10l-2 2 2 2M19 10l2 2-2 2M10 5l2-2 2 2M10 19l2 2 2-2"/>',
  rotate:     '<path d="M4 12a8 8 0 1 1 2.34 5.66"/><path d="M4 19v-4h4"/>',
  scale:      '<path d="M3 21v-6M3 21h6M21 3v6M21 3h-6M14 10l7-7M10 14l-7 7"/>',
  // ── MEASURING ────────────────────────────────────────
  ruler:      '<path d="M21 3L3 21"/><path d="M4.2 14l2.1 2.1M7.8 10.4l2.1 2.1M11.4 6.8l2.1 2.1M15 3.2l2.1 2.1"/><path d="M3 17v4h4"/>',
  angle:      '<path d="M4 4v16h16"/><path d="M4 12a8 8 0 0 0 8 8"/>',
  area:       '<path d="M4 6l6-3 10 5-2 10-9 2-5-3z"/>',
  // ── WELD ─────────────────────────────────────────────
  weld:       '<path d="M3 17l3-10 3 10 3-10 3 10 3-10 3 10"/>',
  // ── FILES / IO ───────────────────────────────────────
  save:       '<path d="M5 3h11l3 3v15H5z"/><path d="M7 3v6h9V3"/><rect x="8" y="13" width="8" height="6"/>',
  folder:     '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  filePlus:   '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>',
  download:   '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload:     '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  file:       '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  chart:      '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  truss:      '<path d="M3 19L12 5l9 14zM6 19l6-8 6 8M12 5v14"/>',
  warning:    '<path d="M12 3L2 21h20z"/><path d="M12 9v5M12 18h.01"/>',
  // ── EDIT ─────────────────────────────────────────────
  copy:       '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:      '<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/>',
  plus:       '<path d="M12 5v14M5 12h14"/>',
  minus:      '<path d="M5 12h14"/>',
  x:          '<path d="M6 6l12 12M18 6L6 18"/>',
  check:      '<path d="M5 12l4 5 10-11"/>',
  arrowLeft:  '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  chevDown:   '<path d="M6 9l6 6 6-6"/>',
  chevUp:     '<path d="M18 15l-6-6-6 6"/>',
  chevLeft:   '<path d="M15 6l-6 6 6 6"/>',
  chevRight:  '<path d="M9 6l6 6-6 6"/>',
  // ── VISIBILITY / LAYERS ──────────────────────────────
  eye:        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:     '<path d="M17.9 17.9A10.8 10.8 0 0 1 12 20c-7 0-11-8-11-8a21 21 0 0 1 5.1-6M9.9 5.1A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a21 21 0 0 1-3.2 4.3M10 10a3 3 0 0 0 4 4M3 3l18 18"/>',
  focus:      '<circle cx="12" cy="12" r="3"/><path d="M3 7V4h3M17 4h3v3M3 17v3h3M17 20h3v-3"/>',
  layers:     '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/>',
  // ── VIEW / VISUAL ────────────────────────────────────
  cube:       '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/>',
  box:        '<path d="M21 8L12 3 3 8l9 5z"/><path d="M21 8v8l-9 5-9-5V8"/>',
  viewTop:    '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 3v18"/>',
  viewFront:  '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h18"/>',
  viewLeft:   '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 3v18"/>',
  viewIso:    '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12v10M21 7l-9 5M3 7l9 5"/>',
  grid:       '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  magnet:     '<path d="M5 3v10a7 7 0 0 0 14 0V3"/><path d="M5 8h4M15 8h4M5 3h4M15 3h4"/>',
  palette:    '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2 1-1.5 2-1.5H18a3 3 0 0 0 3-3c0-4.5-4-9.5-9-9.5z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  // ── UI ───────────────────────────────────────────────
  search:     '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  terminal:   '<path d="M4 17l6-6-6-6M12 19h8"/>',
  settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.14.7.35 1 .6H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sliders:    '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  info:       '<circle cx="12" cy="12" r="10"/><path d="M12 8h.01M11 12h1v4h1"/>',
  theme:      '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  home:       '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
  graduation: '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  lock:       '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  user:       '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logIn:      '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  // ── ARRAY / ALIGN ────────────────────────────────────
  arrayLinear:'<rect x="2" y="9" width="4" height="6"/><rect x="10" y="9" width="4" height="6"/><rect x="18" y="9" width="4" height="6"/>',
  arrayPolar: '<circle cx="12" cy="12" r="9"/><rect x="10" y="1" width="4" height="5"/><rect x="10" y="18" width="4" height="5"/><rect x="1" y="10" width="5" height="4"/><rect x="18" y="10" width="5" height="4"/>',
  alignH:     '<path d="M3 12h18"/><rect x="6" y="6" width="3" height="12"/><rect x="12" y="8" width="3" height="8"/><rect x="18" y="4" width="3" height="16"/>',
  alignV:     '<path d="M12 3v18"/><rect x="6" y="6" width="12" height="3"/><rect x="8" y="12" width="8" height="3"/><rect x="4" y="18" width="16" height="3"/>',
  // ── MISC CAD ─────────────────────────────────────────
  beam:       '<path d="M3 11h18v2H3z"/><path d="M3 7h3v10H3zM18 7h3v10h-3z"/>',
  column:     '<path d="M11 3h2v18h-2z"/><path d="M7 3h10v3H7zM7 18h10v3H7z"/>',
  circle:     '<circle cx="12" cy="12" r="8"/>',
  square:     '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  triangle:   '<path d="M4 20 L20 20 L4 4 z"/>',
  bolt:       '<path d="M9 3h6l2 3v2h-2v9l-3 4-3-4V8H7V6z"/>',
  nut:        '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="3"/>',
  washer:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  anchor:     '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 14a7 7 0 0 0 14 0"/>',
  plate:      '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M6 8v8M10 8v8M14 8v8M18 8v8"/>',
  wand:       '<path d="M14 4l6 6M3 21l11-11M16 2l2 2M20 6l2 2M8 14l2 2"/>',
  copyCheck:  '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><path d="M11 13l2 2 4-4"/>',
  refresh:    '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 4v4h-4M3 20v-4h4"/>',
  // ── FALLBACK ─────────────────────────────────────────
  dot:        '<circle cx="12" cy="12" r="3"/>',
};

/**
 * Return an SVG string for the given icon name.
 * @param {string} name - icon key (see PATHS)
 * @param {number} size - pixel size (width & height)
 * @param {{color?:string, cls?:string, stroke?:number}} [opts]
 */
export function icon(name, size = 16, opts = {}) {
  const body = PATHS[name] || PATHS.dot;
  const color = opts.color || 'currentColor';
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const stroke = opts.stroke || 1.6;
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Convenience inline icon with text label. */
export function iconLabel(name, label, size = 14) {
  return `<span class="icon-label">${icon(name, size)}<span>${label}</span></span>`;
}

/** Brand logo — used on login and header. */
export function brandLogo(size = 28) {
  const gradientId = `ep-metal-${Math.random().toString(36).slice(2, 8)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Estructuras Pro">
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.24" stop-color="#aeb7c5"/>
        <stop offset="0.52" stop-color="#f4f7fb"/>
        <stop offset="0.78" stop-color="#7e8999"/>
        <stop offset="1" stop-color="#dce2ea"/>
      </linearGradient>
    </defs>
    <path d="M10 7h45l-8 9H23v11l8 7-8 7v8h25l8 8H10z"
      fill="url(#${gradientId})" stroke="#f5f8fc" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M29 27h25l-8 10H29l-6-5z"
      fill="url(#${gradientId})" stroke="#f5f8fc" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>`;
}
