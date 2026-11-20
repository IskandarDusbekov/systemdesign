// =========================================================================
// board.js — serverxona doskasi: bloklar, strelkalar, so'rovlar oqimi.
//   * blokni sudrash        -> ko'chirish
//   * o'ngdagi ● nuqtadan    -> strelka tortish (ulash)
//   * bosish                -> tanlash (o'ng panelda sozlamalar)
//   * menyudan sudrab tashlash -> yangi blok
// =========================================================================
import { blockShape } from "./icons.js";

const NODE_W = 150;
const SHAPE_CY = 63;      // blok shakli markazining balandligi (tugun ichida)
const SNAP = 10;
const NO_OUTPUT = ["redis", "replica", "media", "payment", "server"];   // bulardan strelka chiqmaydi
// Har bir serverga o'z rangi: xizmatlarning yorlig'i shu rangda bo'ladi
export const HOST_COLORS = ["#cfe3b2", "#d6e5f6", "#fcdcbd", "#e7ddf5", "#fde3a7", "#f6cfc7"];
export function hostColor(state, hostId) {
  const servers = state.blocks.filter((b) => b.kind === "server");
  const i = servers.findIndex((b) => b.id === hostId);
  return i < 0 ? "#fff" : HOST_COLORS[i % HOST_COLORS.length];
}

let ctx = null;           // {state, catalog, ui, actions}
const pos = new Map();    // blockId -> {x, y} (sudrash paytida jonli)
let zoom = 1;             // doska kichik bo'lsa hamma bloklar sig'ishi uchun kichraytiramiz

// Bloklar doskaga sig'adigan masshtabni hisoblash
function fitZoom(blocks) {
  const board = $("board");
  const maxX = Math.max(...blocks.map((b) => b.x + NODE_W + 20), 400);
  const maxY = Math.max(...blocks.map((b) => b.y + 170), 300);
  const z = Math.min(1, (board.clientWidth - 10) / maxX, Math.max(0.6, (board.clientHeight - 10) / maxY));
  zoom = Math.max(0.55, +z.toFixed(3));
  ["nodes", "edges"].forEach((id) => { $(id).style.transform = `scale(${zoom})`; });
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderBoard(context) {
  ctx = context;
  const { state, catalog, ui } = ctx;
  const nodes = $("nodes");
  pos.clear();
  state.blocks.forEach((b) => pos.set(b.id, { x: b.x, y: b.y }));

  const m = state.metrics;
  const byId = new Map(state.blocks.map((b) => [b.id, b]));
  nodes.innerHTML = state.blocks.map((b) => {
    const spec = catalog.blocks[b.kind];
    const st = m.node_status[b.id];
    const isServer = b.kind === "server";
    const h = isServer ? m.hosts[b.id] : null;
    const over = h && (h.over_cpu || h.over_ram);
    const cls = [
      "node", isServer ? "is-server" : "",
      ui.selected?.type === "block" && ui.selected.id === b.id ? "selected" : "",
      st === "red" || over ? "u-r" : st === "yellow" ? "u-y" : st === "off" ? "off" : "",
      b.kind === "redis" && b.config.bind === "0.0.0.0" && !b.config.password ? "warn" : "",
      isServer && b.config.public && !b.config.firewall ? "warn" : "",
    ].join(" ");
    let label = m.labels[b.id] || "";
    if (isServer && h) label = `${h.cpu_used}/${h.cpu_total} CPU · ${(h.ram_used / 1024).toFixed(1)}/${h.ram_total / 1024} GB`;
    const port = NO_OUTPUT.includes(b.kind) ? "" : `<span class="port" data-port="${b.id}" title="Strelka tortish"></span>`;
    // Server: IP manzil yorlig'i. Xizmat: qaysi serverda ishlaydi (server rangida)
    let foot = "";
    if (isServer) {
      foot = `<span class="chip-ip" style="background:${hostColor(state, b.id)}">${esc(b.ip)}${b.config.public ? "" : " · ichki"}</span>`;
    } else if (b.host) {
      const host = byId.get(b.host);
      foot = `<span class="chip-host" style="background:${hostColor(state, b.host)}">▣ ${esc(host?.name || "?")}</span>`;
    } else if (!spec.external) {
      foot = `<span class="chip-host none">serversiz!</span>`;
    }
    return `<div class="${cls}" data-id="${b.id}" style="left:${b.x}px;top:${b.y}px">
        <span class="chip-top">${esc(label)}</span>
        <div class="shape">${blockShape(spec)}${port}</div>
        <span class="chip-name">${esc(b.name || spec.title)} <small>· ${esc(spec.title)}</small></span>
        ${foot}
      </div>`;
  }).join("");
  // Server yo'q: doska nima ekanini tushuntiramiz — bu sizning serverlaringiz
  if (!state.blocks.some((b) => b.kind === "server")) {
    nodes.insertAdjacentHTML("beforeend", `<div class="board-empty">
      <b>Bu doska — sizning serverlaringiz</b>
      <span>Saytingiz internetga ulangan, 24 soat yoqiq turadigan kompyuterda — <b>serverda</b> ishlaydi. Doskadagi har
        <b>Server</b> bloki — ijaraga olingan bitta shunday kompyuter. Nginx, Sayt (Django), PostgreSQL, Redis — shu server
        <i>ichida</i> ishlaydigan dasturlar, shuning uchun avval server kerak.</span>
      <span class="be-go">↑ Yuqoridagi <b>Server</b> blokini shu yerga sudrang (yoki bosib → "Doskaga qo'shish")</span></div>`);
  }

  fitZoom(state.blocks);
  drawEdges();
}

// Blokning band bo'lishi (strelka rangi uchun)
function utilOf(id, util) {
  return util[id] || 0;
}

function anchor(id, side) {
  const p = pos.get(id);
  if (!p) return null;
  return { x: p.x + (side === "out" ? NODE_W / 2 + 46 : NODE_W / 2 - 46), y: p.y + SHAPE_CY };
}

function curve(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

// Strelka bo'ylab nima ketyapti: maqsad blokka qarab turi, rangi va qisqa yozuvi
export const FLOWS = {
  http: { color: "#2f7fd8", label: "HTTP", title: "Brauzer so'rovi (sahifa ochish, xarid)" },
  proxy: { color: "#14a39a", label: "proxy", title: "Nginx/LB so'rovni Saytga (Django) uzatadi" },
  sql: { color: "#8a5cd1", label: "SQL", title: "Baza so'rovi: o'qish/yozish" },
  cache: { color: "#d94848", label: "kesh", title: "Redis: tez xotiradan o'qish" },
  pay: { color: "#2f9e44", label: "to'lov", title: "To'lov API: pul o'tkazmasi" },
  auth: { color: "#e0a020", label: "OTP", title: "Avtorizatsiya: kod yuborish/tekshirish" },
  task: { color: "#a0663a", label: "vazifa", title: "Fon ishchisiga og'ir vazifa (navbat)" },
  bot: { color: "#d6589f", label: "bot", title: "Telegram bot xabarlari" },
  file: { color: "#6b7a8f", label: "fayl", title: "Rasm/fayl (media, CDN)" },
};
export function flowOf(srcKind, dstKind) {
  if (["postgres", "replica", "pgbouncer"].includes(dstKind)) return "sql";
  if (dstKind === "redis") return "cache";
  if (dstKind === "payment") return "pay";
  if (dstKind === "auth") return "auth";
  if (dstKind === "worker") return "task";
  if (dstKind === "tgbot") return "bot";
  if (["media", "cdn"].includes(dstKind) && srcKind !== "users") return "file";
  if (dstKind === "app" && ["nginx", "lb"].includes(srcKind)) return "proxy";
  return "http";
}

export function drawEdges() {
  const { state, ui } = ctx;
  const byId = new Map(state.blocks.map((b) => [b.id, b]));
  const m = state.metrics;
  const flowing = m.path_ok && m.rps > 0;
  const dots = Math.max(1, Math.min(4, Math.round(1 + Math.log10(Math.max(1, m.rps)))));

  let defs = `<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#34302b"/></marker></defs>`;
  let body = "";
  const labels = [];
  state.connections.forEach((c) => {
    const s = byId.get(c.source), t = byId.get(c.target);
    if (!s || !t) return;
    const a = anchor(s.id, "out"), b = anchor(t.id, "in");
    const d = curve(a, b);
    const u = utilOf(t.id, m.util);
    const off = m.node_status[t.id] === "off" || m.node_status[s.id] === "off";
    const cls = ["edge", off ? "off" : u >= 1 ? "u-r" : u >= 0.7 ? "u-y" : "",
      ui.selected?.type === "edge" && ui.selected.id === c.id ? "selected" : ""].join(" ");
    const fk = flowOf(s.kind, t.kind), fl = FLOWS[fk];
    body += `<path id="e${c.id}" class="${cls}" d="${d}" marker-end="url(#arrow)" ${off || u >= 0.7 ? "" : `style="stroke:${fl.color}"`}/>`;
    labels.push({ id: c.id, fk, off });
    body += `<path class="edge-hit" data-edge="${c.id}" d="${d}"/>`;
    if (flowing && !off) {
      const dur = (u >= 1 ? 3.6 : u >= 0.7 ? 2.4 : 1.6).toFixed(1);
      for (let i = 0; i < dots; i++) {
        body += `<circle class="flow-dot" r="4.5" style="fill:${fl.color}"><title>${fl.title}</title><animateMotion dur="${dur}s" begin="${(i * dur / dots).toFixed(2)}s" repeatCount="indefinite"><mpath href="#e${c.id}"/></animateMotion></circle>`;
      }
    }
  });
  if (ui.tempEdge) body += `<path class="edge selected" d="${ui.tempEdge}" stroke-dasharray="6 4"/>`;
  $("edges").innerHTML = defs + body;
  // strelka o'rtasida yozuv: nima ketyapti
  const svg = $("edges");
  let tags = "";
  labels.forEach(({ id, fk, off }) => {
    const p = svg.querySelector(`#e${id}`);
    if (!p) return;
    let pt;
    try { pt = p.getPointAtLength(p.getTotalLength() / 2); } catch { return; }
    const fl = FLOWS[fk];
    const w = fl.label.length * 6.4 + 12;
    tags += `<g class="edge-tag ${off ? "off" : ""}" transform="translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})"><title>${fl.title}</title>
      <rect x="${-w / 2}" y="-8" width="${w}" height="16" rx="8" style="stroke:${off ? "#b9ae9f" : fl.color}"/>
      <text y="4" text-anchor="middle" style="fill:${off ? "#8a8276" : fl.color}">${fl.label}</text></g>`;
  });
  svg.insertAdjacentHTML("beforeend", tags);
}

// -------------------------------------------------------------------------
// Sichqoncha bilan ishlash (bir marta o'rnatiladi)
// -------------------------------------------------------------------------
export function initBoard() {
  const board = $("board");
  let drag = null;   // {id, dx, dy, startX, startY, moved}
  let link = null;   // {from}

  const local = (e) => {
    const r = board.getBoundingClientRect();
    return { x: (e.clientX - r.left + board.scrollLeft) / zoom, y: (e.clientY - r.top + board.scrollTop) / zoom };
  };
  window.addEventListener("resize", () => { if (ctx) { fitZoom(ctx.state.blocks); } });

  board.addEventListener("mousedown", (e) => {
    const port = e.target.closest("[data-port]");
    if (port) {
      e.preventDefault();
      link = { from: Number(port.dataset.port) };
      document.querySelectorAll(".node").forEach((n) => n.classList.add("connect-target"));
      return;
    }
    const node = e.target.closest(".node");
    if (node) {
      e.preventDefault();
      const id = Number(node.dataset.id);
      const p = local(e), b = pos.get(id);
      drag = { id, node, dx: p.x - b.x, dy: p.y - b.y, startX: p.x, startY: p.y, moved: false };
      return;
    }
    const edge = e.target.closest("[data-edge]");
    if (edge) {
      ctx.actions.select({ type: "edge", id: Number(edge.dataset.edge) });
      return;
    }
    ctx.actions.select(null);
  });

  window.addEventListener("mousemove", (e) => {
    if (!ctx) return;
    if (drag) {
      const p = local(e);
      if (Math.abs(p.x - drag.startX) + Math.abs(p.y - drag.startY) > 3) drag.moved = true;
      if (!drag.moved) return;
      const x = Math.max(0, Math.round((p.x - drag.dx) / SNAP) * SNAP);
      const y = Math.max(0, Math.round((p.y - drag.dy) / SNAP) * SNAP);
      pos.set(drag.id, { x, y });
      drag.node.style.left = x + "px";
      drag.node.style.top = y + "px";
      drawEdges();
    } else if (link) {
      ctx.ui.tempEdge = curve(anchor(link.from, "out"), local(e));
      drawEdges();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (drag) {
      const d = drag;
      drag = null;
      if (d.moved) {
        const p = pos.get(d.id);
        ctx.actions.move(d.id, p.x, p.y);
      } else {
        ctx.actions.select({ type: "block", id: d.id });
      }
    }
    if (link) {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".node");
      const from = link.from;
      link = null;
      ctx.ui.tempEdge = null;
      document.querySelectorAll(".node").forEach((n) => n.classList.remove("connect-target"));
      drawEdges();
      if (target && Number(target.dataset.id) !== from) ctx.actions.connect(from, Number(target.dataset.id));
    }
  });

  // Menyudan sudrab tashlash
  board.addEventListener("dragover", (e) => { e.preventDefault(); board.classList.add("drop-ok"); });
  board.addEventListener("dragleave", () => board.classList.remove("drop-ok"));
  board.addEventListener("drop", (e) => {
    e.preventDefault();
    board.classList.remove("drop-ok");
    const kind = e.dataTransfer.getData("text/kind");
    if (!kind) return;
    const p = local(e);
    ctx.actions.drop(kind, Math.round((p.x - NODE_W / 2) / SNAP) * SNAP, Math.round((p.y - SHAPE_CY) / SNAP) * SNAP);
  });
}

// Doska koordinatasi (blok x/y) → ekrandagi nuqta (ko'rsatma animatsiyasi uchun)
export function boardPoint(x, y) {
  const b = $("board"), r = b.getBoundingClientRect();
  return [r.left + x * zoom - b.scrollLeft, r.top + y * zoom - b.scrollTop];
}

// Bo'sh joy topish (menyuda bosilganda)
export function freeSpot(state) {
  for (let y = 40; y < 640; y += 170) {
    for (let x = 60; x < 1200; x += 190) {
      if (!state.blocks.some((b) => Math.abs(b.x - x) < 160 && Math.abs(b.y - y) < 150)) return { x, y };
    }
  }
  return { x: 80, y: 520 };
}
