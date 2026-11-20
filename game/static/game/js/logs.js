// =========================================================================
// logs.js — jonli loglar oqimi (doska pastida).
//   Real serverdagi kabi: nginx so'rovlari, to'lovlar, xatolar, ogohlantirishlar.
//   Har qator tizimning HOZIRGI holatidan yasaladi: sekin bo'lsa — sekin
//   javoblar, xato bo'lsa — 502, to'lov yo'q bo'lsa — "bepul foydalandi".
//   Kun yakunlari va o'yinchining amallari ham shu yerga yoziladi.
// =========================================================================
import { esc } from "./tpl.js";

const MAX = 300;
const lines = [];          // {t, kind, cls, text}
let paused = false, filter = "all", getState = null, seq = 1040;

const FILTERS = { all: "hammasi", err: "xatolar", money: "pul", you: "amallar" };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const PATHS = ["/", "/products/", "/products/42/", "/cart/", "/api/items/", "/auth/otp/", "/static/app.css", "/media/p17.jpg", "/checkout/"];
const NAMES = ["aziz", "dilnoza", "sardor", "malika", "jasur", "nodira", "bekzod", "kamola", "otabek", "shahlo"];
const SLOW = {
  app: "gunicorn WARN  hamma worker band — so'rovlar navbatda turibdi",
  postgres: "postgres WARN  sekin so'rov 1.8s: SELECT * FROM app_order JOIN app_item ...",
  nginx: "nginx WARN  worker_connections yetmayapti",
  pgbouncer: "pgbouncer WARN  ulanishlar hovuzi to'ldi",
  redis: "redis WARN  xotira to'lmoqda (maxmemory)",
  worker: "celery WARN  vazifalar navbati o'smoqda",
  lb: "haproxy WARN  backendlar band",
};

const clock = () => new Date().toTimeString().slice(0, 8);

const listeners = [];
export const onLog = (fn) => listeners.push(fn);
let lastRoom = null;
const roomId = () => (getState && getState() ? getState().room.id : null);
export const recentLogs = (kind, n) => lines.filter((l) => l.kind === kind && l.room === roomId()).slice(-n).reverse();

export function logPush(kind, text, cls = "") {
  const room = roomId();
  if (room !== lastRoom && room !== null) {
    // xona almashdi — loglarda ajratuvchi qator
    if (lastRoom !== null) lines.push({ t: clock(), kind: "sys", cls: "muted", text: `──── startup: ${getState().room.name} ────`, room });
    lastRoom = room;
  }
  const l = { t: clock(), kind, cls, text, room };
  lines.push(l);
  if (lines.length > MAX) lines.shift();
  draw();
  listeners.forEach((fn) => fn(l));
}

// Tizim holatidan bitta log qatori
function synth(state) {
  const m = state.metrics, L = state.launch, f = state.finance;
  if (!L.domain || !L.done.deploy) {
    return Math.random() < 0.15
      ? ["sys", "info  sayt hali internetda emas — 🚀 qadamlarini bajaring, hech kim kira olmaydi", "muted"] : null;
  }
  if (m.status === "down") return ["err", `nginx  GET ${pick(PATHS)} 502 Bad Gateway — javob beradigan Sayt yo'q`, "err"];
  const r = Math.random();
  if (L.pending_migration && r < 0.15) return ["err", `django ERROR  relation "app_order" does not exist — migrate qilinmagan`, "err"];
  if (Math.random() < m.error_rate) {
    return ["err", `nginx  ${pick(["GET", "POST"])} ${pick(PATHS)} ${pick(["502", "504"])} ${Math.round(rnd(1000, 3000))}ms`, "err"];
  }
  const rows = (f.sales && f.sales.rows) || [];
  const wpick = (key) => {           // sotuv soniga qarab mahsulot tanlash
    const tot = rows.reduce((s, x) => s + x[key], 0);
    let t = Math.random() * tot;
    return rows.find((x) => (t -= x[key]) <= 0) || rows[0];
  };
  if (rows.length && f.sales.orders > 0 && r < 0.22) {
    const o = wpick("paid");
    return ["money", `payment  buyurtma #${++seq}: ${o.emoji} ${o.name} ${"$" + o.price} to'landi — @${pick(NAMES)}`, "ok"];
  }
  if (rows.length && f.sales.lost && r < 0.22) {
    const o = wpick("qty");
    return ["money", `checkout  @${pick(NAMES)} ${o.emoji} ${o.name} ni olmoqchi edi — to'lov ishlamadi, $0`, "err"];
  }
  if (f.sales && f.sales.ads > 0 && r < 0.28) return ["money", `ads  reklama ko'rsatildi: ${pick(PATHS)} +$0.0${Math.floor(rnd(1, 9))}`, ""];
  if (!rows.length && f.revenue > 0 && r < 0.2) return ["money", `payment  to'lov qabul qilindi +$${rnd(1, 6).toFixed(2)} — @${pick(NAMES)}`, "ok"];
  if (!L.done.ssl && r < 0.22) return ["err", "browser WARN  http:// — \"Xavfsiz emas\", to'lov formasi ochilmadi", "warn"];
  if (f.revenue === 0 && !rows.length && r < 0.3) return ["money", `app  @${pick(NAMES)} xizmatdan bepul foydalandi — to'lov yo'q, $0`, "warn"];
  if (m.bot_ok && r < 0.36) return ["info", `tgbot  /start ← @${pick(NAMES)}_${Math.floor(rnd(10, 99))}`, ""];
  if (m.bottleneck_kind && SLOW[m.bottleneck_kind] && r < 0.46) return ["err", SLOW[m.bottleneck_kind], "warn"];
  const over = Object.entries(m.hosts || {}).find(([, h]) => h.over_cpu || h.over_ram);
  if (over && r < 0.52) {
    const b = state.blocks.find((x) => x.id === Number(over[0]));
    return ["err", `kernel WARN  ${b ? b.name : "server"}: ${over[1].over_cpu ? "CPU 100%" : "RAM tugadi"} — undagi hamma xizmat sekin`, "warn"];
  }
  const ms = Math.max(4, Math.round(rnd(0.3, 1.1) * m.p95_ms));
  return ["info", `nginx  ${pick(["GET", "GET", "GET", "POST"])} ${pick(PATHS)} 200 ${ms}ms`, ms > 1000 ? "warn" : ""];
}

const visible = (l) => (l.room == null || l.room === roomId()) && (filter === "all"
  || (filter === "err" && (l.kind === "err" || l.cls === "err" || l.cls === "warn"))
  || (filter === "money" && (l.kind === "money" || l.kind === "day"))
  || (filter === "you" && (l.kind === "you" || l.kind === "day")));

function draw() {
  const box = document.getElementById("logBox");
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
  box.innerHTML = lines.filter(visible).slice(-150).map((l) =>
    `<div class="log ${l.cls} k-${l.kind}"><span class="log-t">${l.t}</span>${esc(l.text)}</div>`).join("")
    || `<div class="muted">Hozircha bo'sh.</div>`;
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function drawControls() {
  const el = document.getElementById("logCtl");
  if (!el) return;
  el.innerHTML = Object.entries(FILTERS).map(([k, v]) =>
    `<button class="chip ${filter === k ? "on" : ""}" data-lf="${k}">${v}</button>`).join("")
    + `<button class="chip" data-lp>${paused ? "▶ davom" : "⏸ pauza"}</button>`;
  el.querySelectorAll("[data-lf]").forEach((b) => b.onclick = () => { filter = b.dataset.lf; drawControls(); draw(); });
  el.querySelector("[data-lp]").onclick = () => { paused = !paused; drawControls(); };
}

export function initLogs(stateFn) {
  getState = stateFn;
  drawControls();
  logPush("sys", "info  loglar shu yerda: har qator — saytingizga kelgan so'rov yoki tizim xabari", "muted");
  setInterval(() => {
    if (paused || document.hidden) return;
    const s = getState();
    if (!s) return;
    const e = synth(s);
    if (e) logPush(...e);
  }, 800);
}
