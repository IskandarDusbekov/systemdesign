// =========================================================================
// icons.js — izometrik bloklar (SVG). Har bir blok turi o'z shakliga ega:
//   server — baland minora (rack)      nginx — darvoza (keng asos + minora)
//   lb     — yassi plita (bo'luvchi)   app   — ustma-ust qatlamlar (workerlar)
//   worker — olti burchakli prizma     cdn   — bulut
//   payment— karta                     tgbot — tanga (disk)
//   postgres — silindr   replica — ikki silindr   redis — yassi disklar
//   pgbouncer — halqa    media — papka   users — platforma va odamlar
// Hammasi bitta 104×82 maydonga chiziladi (catalog.BLOCKS[...].shape).
// =========================================================================

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const INK = "#1d1b18";
const S = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`;

// Ustki yuzadagi belgilar (markaz 0,0; taxminan ±12)
const GLYPHS = {
  shield: `<path d="M0 -11 L9 -7 L8 3 Q4 10 0 12 Q-4 10 -8 3 L-9 -7 Z" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`,
  server: `<path d="M-9 -6 H9 M-9 0 H9 M-9 6 H9" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  gear: `<circle r="9" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 2.5"/><circle r="4" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
  rack: `<circle cx="-5" cy="0" r="2" fill="#3fa456"/><circle cx="2" cy="0" r="2" fill="#e8a33a"/>`,
  globe: `<circle r="10" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
          <ellipse rx="4.5" ry="10" fill="none" stroke="${INK}" stroke-width="1.1"/>
          <path d="M-10 0 H10 M-8 -5 H8 M-8 5 H8" stroke="${INK}" stroke-width="1"/>`,
  split: `<circle cx="-9" cy="0" r="3" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
          <path d="M-6 0 H-1 M-1 -8 V8 M-1 -8 H9 M-1 0 H9 M-1 8 H9" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  card: `<path d="M-14 -3 H14" stroke="${INK}" stroke-width="3"/><path d="M-10 5 H-2" stroke="${INK}" stroke-width="1.8"/>`,
  plane: `<path d="M-8 1 L9 -7 L5 8 L0 3 Z" fill="#2f9fd8" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M0 3 L9 -7" stroke="${INK}" stroke-width="1"/>`,
  pool: `<circle cx="-6" cy="-4" r="3" fill="#fff" stroke="${INK}" stroke-width="1.3"/>
         <circle cx="6" cy="-4" r="3" fill="#fff" stroke="${INK}" stroke-width="1.3"/>
         <circle cx="0" cy="6" r="3" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`,
};

// Izometrik quti: ustki romb markazi (cx, ty), yarim kenglik hw, balandlik h
function box(cx, ty, hw, h, color, glyph = null, scale = 1) {
  const hh = hw / 2;
  const left = shade(color, 0.1), right = shade(color, 0.2);
  return `
    <polygon points="${cx - hw},${ty} ${cx},${ty + hh} ${cx},${ty + hh + h} ${cx - hw},${ty + h}" fill="${left}" ${S}/>
    <polygon points="${cx + hw},${ty} ${cx},${ty + hh} ${cx},${ty + hh + h} ${cx + hw},${ty + h}" fill="${right}" ${S}/>
    <polygon points="${cx},${ty - hh} ${cx + hw},${ty} ${cx},${ty + hh} ${cx - hw},${ty}" fill="${color}" ${S}/>
    ${glyph ? `<g transform="translate(${cx} ${ty}) matrix(${0.85 * scale} ${0.41 * scale} ${-0.85 * scale} ${0.41 * scale} 0 0)">${GLYPHS[glyph] || ""}</g>` : ""}`;
}

// Silindr: ustki ellips markazi (cx, ty), radiuslar rx/ry, balandlik h
function cyl(cx, ty, rx, ry, h, color, glyph = null) {
  const side = shade(color, 0.12);
  return `
    <path d="M${cx - rx} ${ty} L${cx - rx} ${ty + h} A${rx} ${ry} 0 0 0 ${cx + rx} ${ty + h} L${cx + rx} ${ty}" fill="${side}" ${S}/>
    <ellipse cx="${cx}" cy="${ty}" rx="${rx}" ry="${ry}" fill="${color}" ${S}/>
    ${glyph ? `<g transform="translate(${cx} ${ty}) scale(1 ${ry / rx * 1.6})">${GLYPHS[glyph] || ""}</g>` : ""}`;
}

const shadow = (cx = 52, cy = 66, rx = 40, ry = 10) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#00000012"/>`;
const wrap = (inner) => `<svg viewBox="0 0 104 82">${inner}</svg>`;

const SHAPES = {
  // Server — baland minora, old yuzida disk uyalari va chiroqlar
  tower(c) {
    const slots = [0, 1, 2, 3].map((i) => `<path d="M58 ${34 + i * 9} L74 ${26 + i * 9}" stroke="${INK}" stroke-width="1.2" opacity=".55"/>`).join("");
    const leds = [0, 1, 2, 3].map((i) => `<circle cx="${34 + 0}" cy="${36 + i * 9}" r="1.8" fill="${i === 0 ? "#3fa456" : "#e8a33a"}" stroke="${INK}" stroke-width=".6"/>`).join("");
    return wrap(shadow(52, 70, 30, 8) + box(52, 18, 26, 46, c, "rack") + slots + leds);
  },
  // Nginx — keng asos ustida qorovul minorasi (darvoza)
  gate(c) {
    return wrap(shadow() + box(52, 40, 44, 14, shade(c, -0.05)) + box(52, 24, 22, 18, c, "shield", 0.75));
  },
  // Load Balancer — yassi keng plita
  slab(c) {
    return wrap(shadow(52, 62, 44, 10) + box(52, 34, 46, 10, c, "split"));
  },
  // Sayt — ustma-ust 3 qatlam (workerlar)
  stack(c) {
    return wrap(shadow() + box(52, 46, 40, 8, shade(c, 0.06)) + box(52, 34, 40, 8, shade(c, 0.03)) + box(52, 22, 40, 8, c, "server", 0.85));
  },
  // Fon ishchisi — olti burchakli prizma
  hex(c) {
    const cx = 52, cy = 28, rx = 40, ry = 19, h = 20;
    const pts = [0, 60, 120, 180, 240, 300].map((a) => [cx + rx * Math.cos(a * Math.PI / 180), cy + ry * Math.sin(a * Math.PI / 180)]);
    const faces = [[0, 1], [1, 2], [2, 3]].map(([a, b], i) => {
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      return `<polygon points="${x1},${y1} ${x2},${y2} ${x2},${y2 + h} ${x1},${y1 + h}" fill="${shade(c, 0.08 + i * 0.06)}" ${S}/>`;
    }).join("");
    return wrap(shadow(52, 64, 40, 10) + faces +
      `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${c}" ${S}/>` +
      `<g transform="translate(${cx} ${cy}) scale(1 .5)">${GLYPHS.gear}</g>`);
  },
  // CDN — bulut
  cloud(c) {
    const circles = [[34, 42, 15], [52, 32, 19], [72, 40, 15], [52, 48, 16]];
    const outline = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="3"/>`).join("");
    const fill = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join("");
    return wrap(shadow(52, 70, 36, 7) + outline + fill + `<g transform="translate(52 42) scale(.9)">${GLYPHS.globe}</g>`);
  },
  // To'lov shlyuzi — bank kartasi
  card(c) {
    return wrap(shadow(52, 60, 42, 9) + box(52, 36, 42, 5, c, "card"));
  },
  // Telegram bot — tanga (yassi disk)
  disc(c) {
    return wrap(shadow(52, 62, 38, 9) + cyl(52, 34, 36, 15, 12, c, "plane"));
  },
  // PostgreSQL — katta silindr
  cyl(c) {
    return wrap(shadow(52, 70, 34, 9) + cyl(52, 22, 32, 11, 40, c) +
      `<path d="M20 36 A32 11 0 0 0 84 36 M20 49 A32 11 0 0 0 84 49" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>
       <ellipse cx="52" cy="22" rx="12" ry="4" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`);
  },
  // Read replica — ikki kichik silindr (nusxa)
  cyl2(c) {
    return wrap(shadow(52, 68, 40, 9) + cyl(36, 26, 18, 7, 32, shade(c, 0.05)) + cyl(68, 32, 18, 7, 30, c));
  },
  // Redis — ustma-ust yassi disklar (tez xotira)
  puck(c) {
    return wrap(shadow(52, 66, 36, 9) + cyl(52, 48, 32, 11, 9, shade(c, 0.08)) + cyl(52, 36, 32, 11, 9, shade(c, 0.04)) + cyl(52, 24, 32, 11, 9, c));
  },
  // PgBouncer — halqa (hovuz)
  ring(c) {
    return wrap(shadow(52, 62, 40, 9) + cyl(52, 32, 40, 16, 12, c) +
      `<ellipse cx="52" cy="32" rx="18" ry="7" fill="#f4ebe0" ${S}/>` +
      `<g transform="translate(52 31) scale(.8 .45)">${GLYPHS.pool}</g>`);
  },
  // media/ — papka
  folder(c) {
    return wrap(shadow() + box(40, 26, 18, 6, shade(c, 0.05)) + box(52, 36, 40, 16, c));
  },
  platform() {
    const people = [[34, 32, "#e7ddf5"], [52, 26, "#cfe3b2"], [70, 32, "#fcdcbd"], [44, 40, "#d6e5f6"], [62, 40, "#f6cfc7"]]
      .map(([x, y, c]) => `<g transform="translate(${x} ${y})">
        <rect x="-4" y="-2" width="8" height="12" rx="4" fill="${c}" stroke="${INK}" stroke-width="1.2"/>
        <circle cy="-6" r="3.5" fill="#fff" stroke="${INK}" stroke-width="1.2"/></g>`).join("");
    return wrap(`
      <polygon points="6,46 52,68 52,76 6,54" fill="#e6ddd0" ${S}/>
      <polygon points="98,46 52,68 52,76 98,54" fill="#d8cdbd" ${S}/>
      <polygon points="52,24 98,46 52,68 6,46" fill="#fbf6ef" ${S}/>
      ${people}`);
  },
};

export function blockShape(spec) {
  const fn = SHAPES[spec.shape];
  if (fn) return fn(spec.color);
  return wrap(box(52, 30, 46, 22, spec.color || "#eee", spec.icon));
}
