// =========================================================================
// ui-icons.js — interfeys ikonlari (SVG, chiziqli, 24×24). Emoji o'rniga.
//   ico("rocket")            → <svg ...> (joriy matn rangida)
//   ico("git", 18, "cls")    → o'lcham va qo'shimcha class
// HTML ichida: <i data-ico="rocket"></i> → hydrateIcons(root) almashtiradi.
// =========================================================================

const P = {
  board: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>`,
  globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`,
  trend: `<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>`,
  chart: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  code: `<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/>`,
  git: `<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 7.2v9.6M18 10.2c0 4-6 3.5-11 7"/>`,
  book: `<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>`,
  cap: `<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>`,
  reset: `<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>`,
  rocket: `<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.1 2.1 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>`,
  terminal: `<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 9l3 3-3 3M12.5 15H17"/>`,
  laptop: `<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20M9.5 19l.5-1.5h4l.5 1.5"/>`,
  server: `<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>`,
  wallet: `<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><path d="M17 14h.01"/>`,
  coins: `<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  check: `<path d="M4 12.5l5 5L20 6.5"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18"/>`,
  play: `<path d="M7 4.5v15l12-7.5z"/>`,
  bulb: `<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.4 1 2.4h6c0-1 .3-1.8 1-2.4a6.5 6.5 0 0 0-4-11.6z"/>`,
  folder: `<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>`,
  folderOpen: `<path d="M3 18V6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h7A1.5 1.5 0 0 1 19.5 9v1.5"/><path d="M3 18l2.6-6.2A1.5 1.5 0 0 1 7 11h14l-3 7.1a1.5 1.5 0 0 1-1.4.9H4z"/>`,
  file: `<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5v5h5"/>`,
  fileCode: `<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5v5h5M10 12.5l-2 2 2 2M14 12.5l2 2-2 2"/>`,
  key: `<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L20 3M16 7l3 3M18 5l2 2"/>`,
  lock: `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  unlock: `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>`,
  alert: `<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,
  star: `<path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/>`,
  eye: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  fork: `<circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2V9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.2M12 12v4.8"/>`,
  branch: `<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2v9.6M18 9.2c0 5-7 3-11 7.6"/>`,
  commit: `<circle cx="12" cy="12" r="3.5"/><path d="M2 12h6.5M15.5 12H22"/>`,
  history: `<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3.5 2"/>`,
  copy: `<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  edit: `<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`,
  trash: `<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>`,
  cart: `<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.5h11.5L22 7H6.2"/>`,
  layers: `<path d="M12 2.5l9.5 5-9.5 5-9.5-5z"/><path d="M2.5 12.5l9.5 5 9.5-5M2.5 17l9.5 5 9.5-5"/>`,
  package: `<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/>`,
  store: `<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9M5 12.5V21h14v-8.5"/><path d="M10 21v-5h4v5"/>`,
  sparkle: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>`,
  download: `<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>`,
  upload: `<path d="M12 21V9M7 14l5-5 5 5M4 5h16"/>`,
  shield: `<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/>`,
  log: `<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>`,
  power: `<path d="M12 2.5v9M6.3 6.3a8 8 0 1 0 11.4 0"/>`,
  pause: `<path d="M8 5v14M16 5v14"/>`,
  arrowRight: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  arrowLeft: `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  chevronDown: `<path d="M6 9l6 6 6-6"/>`,
  browser: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01M12.5 6.5h.01"/>`,
  chevronLeft: `<path d="M15 6l-6 6 6 6"/>`,
  chevronRight: `<path d="M9 6l6 6-6 6"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>`,
  film: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4"/>`,
  hand: `<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a8 8 0 0 1-8 8h-.5a7 7 0 0 1-5.6-2.8L3 16.5a1.6 1.6 0 0 1 2.5-2L7 16V11"/>`,
  dot: `<circle cx="12" cy="12" r="4" fill="currentColor"/>`,
};

export function ico(name, size = 16, cls = "") {
  const body = P[name];
  if (!body) return "";
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// <i data-ico="rocket" data-size="18"></i> → SVG
export function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-ico]").forEach((el) => {
    el.outerHTML = ico(el.dataset.ico, Number(el.dataset.size) || 16, el.className || "");
  });
}

// Fayl turi → ikon (Kod bo'limi, GitHub ro'yxati)
export function fileIco(path, size = 15) {
  const name = path.split("/").pop();
  if (name.startsWith(".env")) return ico("key", size, "fi fi-env");
  if (name.endsWith(".py")) return ico("fileCode", size, "fi fi-py");
  if (name.endsWith(".html")) return ico("fileCode", size, "fi fi-html");
  if (name.endsWith(".css")) return ico("fileCode", size, "fi fi-css");
  if (name.endsWith(".md")) return ico("book", size, "fi fi-md");
  if (name.endsWith(".conf") || name.endsWith(".service") || name.endsWith(".sh")) return ico("terminal", size, "fi fi-cfg");
  return ico("file", size, "fi");
}
