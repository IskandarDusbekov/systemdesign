// =========================================================================
// demo.js — "Noldan qurib ko'rsat": tizim o'zi sichqonchani yurgizib,
// bloklarni paneldan doskaga sudraydi, strelkalarni ulaydi, model yaratadi.
// Har qadamda pastda izoh: nima qilindi va nega. Keyin o'yinchi o'zi davom etadi.
// =========================================================================
import { boardPoint } from "./board.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopped = false;

const BUILD = [
  { kind: "server", x: 330, y: 360, text: "<b>Server</b> — ijaraga olingan kompyuter (VPS). Hamma dasturlar shu ichida ishlaydi. Pul faqat shunga ketadi: $50/kun ijara." },
  { kind: "nginx", x: 190, y: 210, text: "<b>Nginx</b> — eshik qorovuli: internetdan kelgan so'rovlarni qabul qilib, Saytga uzatadi. Bepul (kod)." },
  { kind: "app", x: 360, y: 210, text: "<b>Sayt (Django)</b> — sizning backend kodingiz: sahifalar, savat, buyurtmalar." },
  { kind: "postgres", x: 540, y: 210, text: "<b>PostgreSQL</b> — baza: mahsulotlar, mijozlar, buyurtmalar shu yerda saqlanadi." },
  { kind: "payment", x: 540, y: 60, text: "<b>To'lov shlyuzi</b> (Payme/Click) — mijoz pul to'laydi. Tushgan pul shlyuz kassasida yig'iladi." },
];
const LINKS = [
  ["users", "nginx", "Strelka = so'rov yo'li. <b>Foydalanuvchilar → Nginx</b>: hamma avval eshikdan kiradi."],
  ["nginx", "app", "<b>Nginx → Sayt</b>: qorovul so'rovni Django ga uzatadi."],
  ["app", "postgres", "<b>Sayt → PostgreSQL</b>: kod ma'lumotni bazadan o'qiydi va yozadi."],
  ["app", "payment", "<b>Sayt → To'lov</b>: \"Sotib olish\" bosilganda to'lov sahifasiga yuboriladi."],
];

function el(cls, html = "") {
  const d = document.createElement("div");
  d.className = cls;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

async function moveTo(cur, x, y, ms = 650) {
  cur.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.3,1)`;
  cur.style.transform = `translate(${x}px, ${y}px)`;
  await sleep(ms + 40);
}
const center = (node) => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(80); }
  return null;
}

async function click(cur, node) {
  if (!node) return;
  node.scrollIntoView({ block: "center", inline: "center" });
  await sleep(150);
  const [x, y] = center(node);
  await moveTo(cur, x, y);
  cur.classList.add("press"); await sleep(180); cur.classList.remove("press");
  node.click();
}

export async function demoBuild({ actions, getState, onDone }) {
  stopped = false;
  window.scrollTo(0, 0);
  const cur = el("demo-cursor", `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2l15 9-7 1.6L9 20z" fill="#fff" stroke="#1d1b18" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  const cap = el("demo-cap");
  const total = BUILD.length + LINKS.length + 2;
  let n = 0;
  const say = (html) => {
    n += 1;
    cap.innerHTML = `<div class="demo-n">🎬 Ko'rsatma · ${n}/${total}</div><div>${html}</div>
      <button class="btn small ghost" id="demoStop">⏹ To'xtatish — o'zim qilaman</button>`;
    cap.querySelector("#demoStop").onclick = () => { stopped = true; };
  };
  cur.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;
  try {
    // 1) bloklarni paneldan doskaga sudrash
    for (const b of BUILD) {
      if (stopped) break;
      say(b.text);
      const have = getState().blocks.find((x) => x.kind === b.kind);
      if (have) {               // allaqachon bor (masalan server) — faqat ko'rsatamiz
        const node = document.querySelector(`#nodes [data-id="${have.id}"] .shape`);
        if (node) { const [hx, hy] = center(node); await moveTo(cur, hx, hy); node.classList.add("demo-glow"); await sleep(1800); node.classList.remove("demo-glow"); }
        continue;
      }
      const tool = document.querySelector(`.tool[data-kind="${b.kind}"]`);
      if (!tool) continue;
      tool.scrollIntoView({ block: "nearest", inline: "center" });
      await sleep(200);
      const [tx, ty] = center(tool);
      await moveTo(cur, tx, ty);
      cur.classList.add("press");
      const r = tool.getBoundingClientRect();
      const ghost = tool.cloneNode(true);
      ghost.className = "tool demo-ghost";
      Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` });
      document.body.appendChild(ghost);
      const [bx, by] = boardPoint(b.x + 52, b.y + 30);
      await sleep(120);
      ghost.style.transform = `translate(${bx - tx}px, ${by - ty}px) scale(1.15)`;
      await moveTo(cur, bx, by, 900);
      cur.classList.remove("press");
      ghost.remove();
      await actions.drop(b.kind, b.x, b.y);
      await sleep(900);
    }
    // 2) strelkalar
    for (const [a, b, text] of LINKS) {
      if (stopped) break;
      say(text);
      const st = getState();
      const src = st.blocks.find((x) => x.kind === a), dst = st.blocks.find((x) => x.kind === b);
      if (!src || !dst) continue;
      if (st.connections.some((c) => c.source === src.id && c.target === dst.id)) continue;
      const port = await waitFor(() => document.querySelector(`#nodes [data-port="${src.id}"]`));
      const target = document.querySelector(`#nodes [data-id="${dst.id}"] .shape`);
      if (!port || !target) continue;
      const [px, py] = center(port), [qx, qy] = center(target);
      await moveTo(cur, px, py);
      const svg = el("demo-line", `<svg width="100%" height="100%"><line x1="${px}" y1="${py}" x2="${px}" y2="${py}"/></svg>`);
      const line = svg.querySelector("line");
      cur.classList.add("press");
      line.style.transition = "all .9s cubic-bezier(.45,.05,.3,1)";
      requestAnimationFrame(() => { line.setAttribute("x2", qx); line.setAttribute("y2", qy); });
      await moveTo(cur, qx, qy, 900);
      cur.classList.remove("press");
      svg.remove();
      await actions.connect(src.id, dst.id);
      await sleep(700);
    }
    // 3) kod: model (jadval) yaratish
    if (!stopped) {
      say("Endi <b>kod</b>: bazada qanday jadvallar bo'lishini <b>Model quruvchi</b> belgilaydi. Biznesingizga mos shablonni qo'yamiz.");
      actions.openFile("app/models.py");
      await sleep(900);
      const tpl = await waitFor(() => document.getElementById("mbTpl"), 2500);
      if (tpl) {
        await click(cur, tpl);
        await sleep(900);
        say("<b>Saqlash · makemigrations</b> — models.py o'zgaradi va yangi migratsiya fayli yoziladi. Deploy paytida u bazaga qo'llanadi.");
        await click(cur, await waitFor(() => { const s = document.getElementById("mbSave"); return s && !s.disabled ? s : null; }, 2500));
        await sleep(1400);
      }
    }
  } finally {
    cur.remove(); cap.remove();
    onDone && onDone(stopped);
  }
}
