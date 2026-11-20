// =========================================================================
// panels.js — doskadan tashqaridagi hamma narsa:
//   holat qatori, xonalar, katta asboblar paneli (toolbar), o'ng panel
//   (senariy / inspektor), kunlik grafik, Git sahifasi, Qo'llanma.
// =========================================================================
import { blockShape } from "./icons.js";
import { usd } from "./report.js";
import { hostColor } from "./board.js";

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const pct = (x) => `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0)}%`;

// -------------------------------------------------------------------------
// Holat qatori (yuqorida)
// -------------------------------------------------------------------------
export function renderStats(state) {
  const r = state.room, m = state.metrics;
  const servers = state.blocks.filter((b) => b.kind === "server");
  const f = state.finance;
  const net = f.net;
  const bn = m.bottleneck ? state.blocks.find((b) => b.id === m.bottleneck) : null;
  const cells = [
    ["Holat", m.status_title, `status-${m.status}`, bn ? `tor bo'g'iz: ${bn.name}` : "tor bo'g'iz yo'q"],
    ["Foydalanuvchi", fmt(r.users), "", state.launch.done.deploy ? "" : "deploydan keyin 50 ta keladi"],
    ["Yuklama", `${m.rps.toFixed(1)} req/s`, "", `${m.apps} ta Sayt · ${m.total_workers} worker`],
    ["Javob p95", `${fmt(m.p95_ms)} ms`, m.p95_ms > 1000 ? "status-red" : m.p95_ms > 300 ? "status-yellow" : "", `hisobot ${fmt(m.report_ms)} ms`],
    m.status === "idle" ? ["Xatolar", "—", "", "sayt hali ochilmagan"]
      : ["Xatolar", pct(m.error_rate), m.error_rate > 0.02 ? "status-red" : m.error_rate > 0.005 ? "status-yellow" : "", ""],
    ["Daromad", `${usd(f.revenue, true)}/kun`, f.revenue > 0 ? "" : "status-yellow", f.revenue > 0 ? `${f.per_user} × foydalanuvchi` : "to'lov yo'q"],
    ["Xarajat", `${usd(-f.cost)}/kun`, f.runway !== null && f.runway <= 3 ? "status-red" : "",
      state.suspended ? "⛔ hosting to'xtagan" : state.neglected ? "⏸ sayt to'xtagan" : f.runway !== null ? `pul ${runwayText(state)} ga yetadi` : "ijara + xizmatlar"],
    ["Serverlar", `${servers.length} ta`, Object.values(m.hosts).some((h) => h.over_cpu || h.over_ram) ? "status-red" : "", servers.map((s) => s.ip).join(" · ")],
  ];
  $("stats").innerHTML = cells.map(([k, v, cls, sub]) =>
    `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${esc(v)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`).join("");
  // soat app.js da har soniya yangilanadi
  $("econLine").textContent = `bugun: daromad ${usd(f.revenue, true)} · xarajat ${usd(-f.cost)} · sof foyda ${usd(net, true)}`;
  // Yuqori panel: katta balans va foyda
  const month = state.history.slice(-30).reduce((s, d) => s + d.revenue - d.cost, 0);
  const kassa = state.kassa || 0;
  $("balance").innerHTML = `<span class="bal-l" title="Bitta hamyon — hamma startuplar uchun">Umumiy balans</span><b class="${r.coins < 0 ? "neg" : ""}">${usd(r.coins)}</b>
    <button class="kassa-btn ${kassa >= 1 ? "full" : ""}" data-withdraw title="To'lov shlyuzida yig'ilgan pul — bosib balansga o'tkazing">
      💰 kassa ${usd(kassa)}${kassa >= 1 ? " · yechib olish" : ""}</button>
    <span class="bal-s ${net > 0 ? "pos" : net < 0 ? "neg" : ""}">bugun ${usd(net, true)}</span>
    <span class="bal-s ${month > 0 ? "pos" : month < 0 ? "neg" : ""}">30 kun ${usd(month, true)}</span>`;
}

// -------------------------------------------------------------------------
// Xonalar (yuqori panelda): almashtirish, yangi, nomlash, o'chirish
// -------------------------------------------------------------------------
export function renderRooms(state, actions) {
  $("rooms").innerHTML = `
    <span class="rooms-l">Startup</span>
    <select id="roomSel" title="Startupni almashtirish">
      ${state.rooms.map((r) => `<option value="${r.id}" ${r.id === state.room.id ? "selected" : ""}>${r.kind === "scenario" ? "★" : "💡"} ${esc(r.name)} · kun ${r.day}</option>`).join("")}
    </select>
    <button class="btn small" id="roomNew" title="Yangi startup yoki g'oya">＋ Yangi g'oya</button>
    <button class="btn small ghost" id="roomRen" title="Nomini o'zgartirish">✎</button>
    <button class="btn small ghost" id="roomDel" title="Startupni o'chirish">🗑</button>`;
  $("roomSel").onchange = (e) => actions.openRoom(Number(e.target.value));
  $("roomNew").onclick = actions.newRoom;
  $("roomRen").onclick = actions.renameRoom;
  $("roomDel").onclick = actions.deleteRoom;
}

// -------------------------------------------------------------------------
// Katta asboblar paneli: qatlamlar bo'yicha guruhlangan bloklar
// -------------------------------------------------------------------------
export function renderToolbar(state, catalog, actions) {
  const count = {};
  state.blocks.forEach((b) => { count[b.kind] = (count[b.kind] || 0) + 1; });
  const groups = catalog.layers.map(([layer, title]) => {
    const items = Object.entries(catalog.blocks)
      .filter(([, s]) => s.layer === layer && !s.fixed)
      .map(([kind, s]) => {
        const n = count[kind] || 0;
        const full = n >= s.max_count;
        const price = kind === "server" ? `$${catalog.servers.orta.rent}/kun` : s.rent ? `$${s.rent}/kun` : s.external ? "foiz/so'rov" : "bepul";
        const res = s.external ? "tashqi xizmat" : kind === "server" ? "ijara · 2 CPU" : `kod · ${s.cpu}${s.per_unit ? "+" : ""} CPU`;
        return `<div class="tool ${full ? "disabled" : ""}" draggable="${!full}" data-kind="${kind}">
          <div class="tool-ico">${blockShape(s)}</div>
          <div class="tool-t">${esc(s.title)}</div>
          <div class="tool-s">${price} · ${res}</div>
          <div class="tool-n">${n}/${s.max_count}</div>
        </div>`;
      }).join("");
    return `<div class="tool-group"><div class="tool-h">${esc(title)}</div><div class="tool-row">${items}</div></div>`;
  }).join("");
  $("toolbar").innerHTML = `${groups}
    <div class="tool-group tool-power"><div class="tool-h">Narxlar</div>
      <div class="tool-s">💻 Dasturlar (Nginx, Django, Postgres...) — <b>bepul</b>, bu kod.<br>
      💳 Pul faqat: server ijarasi, domen va tashqi xizmatlar (CDN, to'lov 2%, SMS).<br>
      Blok ustiga keling — tushuntirish chiqadi.</div>
    </div>`;
  $("toolbar").querySelectorAll(".tool").forEach((el) => {
    el.addEventListener("dragstart", (e) => { hidePop(true); e.dataTransfer.setData("text/kind", el.dataset.kind); });
    el.addEventListener("mouseenter", () => showPop(el, state, catalog, actions, false));
    el.addEventListener("mouseleave", () => hidePop());
    el.addEventListener("click", () => showPop(el, state, catalog, actions, true));
  });
}

// Qo'shilsa nima bo'ladi: bir martalik narx va kunlik xarajat o'zgarishi
function whatIf(kind, s, state, catalog) {
  const daily = kind === "server" ? catalog.servers.orta.rent : (s.rent || 0);
  const f = state.finance;
  if (!daily) return `<div class="tp-what"><b>Qo'shsangiz:</b> bepul — bu dastur (kod), mavjud server ichida ishlaydi.
    ${s.external ? "<div class='muted small'>Tashqi xizmat: ishlatilganiga qarab haq oladi (masalan to'lov 2%, SMS $0.02).</div>" : "<div class='muted small'>Faqat serverda joy (CPU/RAM) kerak.</div>"}</div>`;
  return `<div class="tp-what"><b>Qo'shsangiz:</b> kuniga +$${daily.toFixed(1)} xarajat
    → sof ${usd(f.net, true)} ⇒ <b class="${f.net - daily >= 0 ? "pos" : "neg"}">${usd(f.net - daily, true)}</b>/kun
    <div class="muted small">Foyda qaytishi blok ishlatilganda: tezlik ↑ → xato ↓, mijoz o'sishi ↑.</div></div>`;
}

// --- Asbob haqida ma'lumot oynasi (hover — ko'rish, bosish — mahkamlash va qo'shish)
let popTimer = null, popPinned = false;
function popEl() {
  let el = document.getElementById("toolPop");
  if (!el) {
    el = document.createElement("div");
    el.id = "toolPop";
    el.className = "tool-pop hidden";
    document.body.appendChild(el);
    el.addEventListener("mouseenter", () => clearTimeout(popTimer));
    el.addEventListener("mouseleave", () => hidePop());
    document.addEventListener("mousedown", (e) => {
      const t = e.target; if (!t.closest || (!t.closest("#toolPop") && !t.closest(".tool"))) hidePop(true);
    });
  }
  return el;
}
function hidePop(force = false) {
  clearTimeout(popTimer);
  if (force) { popPinned = false; popEl().classList.add("hidden"); return; }
  if (popPinned) return;
  popTimer = setTimeout(() => popEl().classList.add("hidden"), 180);
}
function showPop(anchor, state, catalog, actions, pin) {
  clearTimeout(popTimer);
  if (pin) popPinned = true;
  const kind = anchor.dataset.kind, s = catalog.blocks[kind];
  const n = state.blocks.filter((b) => b.kind === kind).length;
  const full = n >= s.max_count;
  const price = kind === "server" ? catalog.servers.orta.rent : 0;
  const reqs = (catalog.requirements[kind] || []).map((r) => `<li>${esc(r.text)}</li>`).join("");
  const res = s.external ? "Tashqi xizmat — serverga joylanmaydi"
    : kind === "server" ? `O'rta: 2 CPU · 4 GB RAM`
    : `${s.cpu} CPU · ${s.ram_mb} MB RAM${s.per_unit ? ` (+ har ${s.per_unit.field} uchun ${s.per_unit.cpu} CPU)` : ""}`;
  const el = popEl();
  el.innerHTML = `
    <div class="tp-head"><div class="tp-ico">${blockShape(s)}</div>
      <div><b>${esc(s.title)}</b><div class="muted">${esc(s.subtitle)}</div></div></div>
    <p>${esc(s.about)}</p>
    <div class="kv small"><span>Narx</span><b>${price ? `$${price}/kun ijara` : s.rent ? `$${s.rent}/kun obuna` : s.external ? "ishlatilganiga qarab" : "bepul (kod)"}</b></div>
    <div class="kv small"><span>Resurs</span><span>${esc(res)}</span></div>
    ${reqs ? `<div class="tp-req"><b>Ishlashi uchun ulang:</b><ul>${reqs}</ul></div>` : ""}
    ${whatIf(kind, s, state, catalog)}
    <div class="row" style="justify-content:space-between;margin-top:8px">
      ${s.guide ? `<button class="link" id="tpGuide">📖 qo'llanma</button>` : "<span></span>"}
      <button class="btn primary small" id="tpAdd" ${full ? "disabled" : ""}>${full ? `ko'pi bilan ${s.max_count} ta` : "＋ Doskaga qo'shish"}</button>
    </div>`;
  const r = anchor.getBoundingClientRect();
  el.classList.remove("hidden");
  const w = 300;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  el.style.top = (r.bottom + 6) + "px";
  el.querySelector("#tpAdd").onclick = () => { hidePop(true); actions.add(kind); };
  const g = el.querySelector("#tpGuide");
  if (g) g.onclick = () => { hidePop(true); actions.guide(s.guide); };
}

// -------------------------------------------------------------------------
// O'ng panel: hech narsa tanlanmagan bo'lsa — senariy va maslahatchi,
// blok tanlangan bo'lsa — inspektor (server, sozlamalar, ulanishlar).
// -------------------------------------------------------------------------
export function renderRight(state, data, ui, actions) {
  const sel = ui.selected;
  if (sel?.type === "block") {
    const block = state.blocks.find((b) => b.id === sel.id);
    if (block) return renderInspector(block, state, data, ui, actions);
  }
  if (sel?.type === "edge") {
    const c = state.connections.find((x) => x.id === sel.id);
    if (c) {
      const n = (id) => state.blocks.find((b) => b.id === id)?.name || "?";
      $("right").innerHTML = `<h2>Strelka</h2><p>${esc(n(c.source))} → ${esc(n(c.target))}</p>
        <button class="btn danger" id="btnDelEdge">Strelkani o'chirish</button>
        <p class="muted">Yoki Delete tugmasini bosing.</p>`;
      $("btnDelEdge").onclick = () => actions.disconnect(c.id);
      return;
    }
  }
  renderOverview(state, data, actions);
}

function bar(used, total) {
  const r = total ? used / total : 0;
  return `<div class="bar ${r > 1 ? "r" : r > 0.8 ? "y" : ""}"><i style="width:${Math.min(100, r * 100)}%"></i></div>`;
}

function serversHtml(state) {
  return state.blocks.filter((b) => b.kind === "server").map((s) => {
    const h = state.metrics.hosts[s.id];
    if (!h) return "";
    return `<div class="srv-card" data-block="${s.id}">
      <div class="kv"><b><i class="sw-dot" style="background:${hostColor(state, s.id)}"></i>${esc(s.name)}</b><span class="mono">${esc(s.ip)}</span></div>
      <div class="kv small"><span>CPU</span><span>${h.cpu_used} / ${h.cpu_total}</span></div>${bar(h.cpu_used, h.cpu_total)}
      <div class="kv small"><span>RAM</span><span>${fmt(h.ram_used)} / ${fmt(h.ram_total)} MB</span></div>${bar(h.ram_used, h.ram_total)}
    </div>`;
  }).join("");
}

// Balans necha soat/kunga yetadi (o'yin vaqti)
function runwayText(state) {
  const f = state.finance, perHour = -f.net / 24;
  if (perHour <= 0) return "";
  const hours = Math.floor(state.room.coins / perHour);
  return hours < 24 ? `${hours} o'yin soati` : `${Math.floor(hours / 24)} kun ${hours % 24} soat`;
}

// Hosting to'xtatilgan: nima bo'ldi va qayta yoqilsa nima bo'ladi
export function suspendedHtml(state) {
  const f = state.finance;
  if (!state.suspended && state.neglected) return `<div class="suspended neglect">
    <b>⏸ Sayt to'xtadi — siz uzoq kirmadingiz</b>
    <p>Egasi 3 kundan ortiq kelmasa, tizim o'zi ishlamaydi: buyurtmalar kelmaydi, lekin server ijarasi to'lanib turadi.
      Har kuni bir marta kirib, holatni tekshirib turing.</p>
    <p>Yoqilsa: <b class="${f.net >= 0 ? "pos" : "neg"}">${usd(f.net, true)}/kun</b>.</p>
    <button class="btn primary" data-resume>▶ Saytni qayta yoqish</button></div>`;
  if (!state.suspended) return "";
  return `<div class="suspended">
    <b>⛔ Hosting to'xtatildi${state.suspended_at ? ` (${esc(state.suspended_at)})` : ""}</b>
    <p>Balans tugadi — serverlar o'chirildi. Sayt ishlamayapti, pul ham ketmayapti. Mijozlar kuniga ~3% kamayadi.</p>
    <p>Qayta yoqilsa: daromad ${usd(f.revenue, true)}, xarajat ${usd(-f.cost)} → <b class="${f.net >= 0 ? "pos" : "neg"}">${usd(f.net, true)}/kun</b>.
      ${f.net < 0 ? "Zarar bilan yoqsangiz — tez orada yana to'xtaydi. Avval server turini kichraytiring yoki keraksiz bloklarni o'chiring." : ""}</p>
    <button class="btn primary" data-resume>▶ Serverlarni qayta yoqish</button></div>`;
}

// Bugungi pul oqimi: qayerdan keladi, qayerga ketadi
function financeHtml(state) {
  const f = state.finance, r = state.room;
  const sign = (x) => usd(x, true);
  return `<div class="fin">
    <div class="fin-h">💰 Moliya · bugun</div>
    ${[...state.growth.campaigns.map((c) => `📣 ${c.id}`), ...state.growth.effects.map((e) => e.title)].length
      ? `<div class="fin-why">Faol: ${[...state.growth.campaigns.map((c) => `📣 kampaniya (${c.days_left} kun)`),
          ...state.growth.effects.map((e) => `${esc(e.title)} (${e.days_left} kun)`)].join(" · ")}</div>` : ""}
    <div class="fin-row in"><span>Daromad</span><b>${sign(f.revenue)}</b></div>
    <div class="fin-why">${esc(f.revenue_why)}</div>
    ${f.items.map((i) => `<div class="fin-row out"><span>${esc(i.label)}</span><b>${usd(-i.amount)}</b></div>`).join("")}
    <div class="fin-row total ${f.net >= 0 ? "pos" : "neg"}"><span>Sof natija</span><b>${sign(f.net)} / kun</b></div>
    <div class="fin-row"><span>Balans: hozir</span><b>${usd(r.coins)}</b></div>
    <div class="fin-row in"><span>💰 To'lov kassasida</span><b>${usd(state.kassa || 0)}</b></div>
    <div class="fin-why">Mijoz to'lovlari avval To'lov shlyuzida yig'iladi. Xarajat esa balansdan ketadi — vaqtida yechib oling.
      ${(state.kassa || 0) >= 1 ? `<button class="btn small primary" data-withdraw>💰 Yechib olish</button>` : ""}</div>
    ${f.runway !== null && !state.suspended ? `<div class="tip ${f.runway <= 1 ? "bad" : "warn"}">Zarar: balans taxminan <b>${runwayText(state)}</b> ga yetadi.
      Tugasa — hosting serverlarni to'xtatadi (sayt ishlamaydi, mijozlar kamayadi). ${f.revenue ? "Xarajatni kamaytiring." : "Avval To'lov shlyuzi + HTTPS."}
      <button class="link" data-guide="money">📖 Pul</button></div>` : ""}
  </div>`;
}

function renderOverview(state, data, actions) {
  const r = state.room;
  const goals = state.goals.map((g) => `
    <div class="goal ${g.done ? "done" : ""}"><span class="box">${g.done ? "✓" : ""}</span>
      <div><div class="txt">${esc(g.text)}</div>
      ${g.hint && !g.done ? `<button class="link" data-guide="${g.hint}">📖 qo'llanma</button>` : ""}</div></div>`).join("");
  const tips = state.advice.map((t) => `
    <div class="tip ${t.level}">${esc(t.text)}
      ${(t.guide || t.block) ? `<div class="links">
        ${t.block ? `<button class="link" data-block="${t.block}">→ blokni ochish</button>` : ""}
        ${t.guide && data.guide[t.guide] ? `<button class="link" data-guide="${t.guide}">📖 ${esc(data.guide[t.guide].title.split(". ")[0])}-bob</button>` : ""}
      </div>` : ""}</div>`).join("");
  const intro = r.kind === "scenario"
    ? data.scenario.intro.map(esc).join("<br>")
    : `<b>${esc(r.name)}</b> — yangi startup. Yuqoridagi paneldan bloklarni qo'shing:<br>
       Foydalanuvchilar → Nginx → Sayt → PostgreSQL zanjirini quring. Har xizmat qaysi serverda ishlashini inspektorda tanlang.`;

  $("right").innerHTML = `
    <div class="intro-box">${intro}</div>
    ${suspendedHtml(state)}
    ${financeHtml(state)}
    ${goals ? `<h2>Maqsadlar</h2>${goals}` : ""}
    <h3>Maslahatchi</h3>${tips}
    <h3>Serverlar</h3>${serversHtml(state) || `<p class="muted">Server yo'q — asboblar panelidan qo'shing.</p>`}`;

  $("right").querySelectorAll("[data-guide]").forEach((el) => el.onclick = () => actions.guide(el.dataset.guide));
  $("right").querySelectorAll("[data-resume]").forEach((el) => el.onclick = () => actions.resume());
  $("right").querySelectorAll("[data-block]").forEach((el) => el.onclick = () => actions.selectBlock(Number(el.dataset.block)));
}

// --- Shablon qatorini qiymatlar bilan chizish (Python render_lines bilan bir xil qoida) ---
export function templateLines(lines, fields, values, fieldHtml) {
  return lines.map((raw) => {
    let line = raw;
    if (raw.startsWith("?")) {
      const sp = raw.indexOf(" ");
      let cond = raw.slice(1, sp);
      line = raw.slice(sp + 1);
      const neg = cond.startsWith("!");
      cond = cond.replace("!", "");
      let ok;
      if (cond.includes("=")) { const [k, val] = cond.split("="); ok = String(values[k]) === val; }
      else ok = Boolean(values[cond]);
      if (ok === neg) return null;
    }
    const isComment = line.trim().startsWith("#");
    const hasField = /\{(\w+)\}/.test(line);
    const html = esc(line).replace(/\{(\w+)\}/g, (_, name) => fields[name] ? fieldHtml(name) : `{${name}}`);
    return `<span class="ln ${isComment && !hasField ? "comment" : ""} ${hasField ? "hl" : ""}">${html || " "}</span>`;
  }).filter(Boolean).join("");
}

export function fieldInput(f, name, v) {
  if (f.type === "bool") {
    const txt = f.fmt === "pybool" ? (v ? "True" : "False") : f.fmt === "yesno" ? (v ? "ha" : "yo'q") : (v ? "on" : "off");
    return `<button class="toggle ${v ? "on" : ""}" data-field="${name}" title="${esc(f.label)}">${txt}</button>`;
  }
  if (f.type === "choice") {
    return `<select data-field="${name}">${f.choices.map(([val, lbl]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(lbl)}</option>`).join("")}</select>`;
  }
  return `<input type="number" data-field="${name}" min="${f.min}" max="${f.max}" value="${v}" title="${esc(f.label)}">`;
}

export function bindFields(box, fields, values, rerender) {
  box.querySelectorAll("[data-field]").forEach((el) => {
    const name = el.dataset.field;
    const f = fields[name];
    if (f.type === "bool") el.onclick = () => { values[name] = !values[name]; rerender(); };
    else el.onchange = () => {
      values[name] = f.type === "int" ? Math.max(f.min, Math.min(f.max, parseInt(el.value || f.min, 10))) : el.value;
      rerender();
    };
  });
}

// --- Inspektor ------------------------------------------------------------
function renderInspector(block, state, data, ui, actions) {
  const spec = data.catalog.blocks[block.kind];
  const code = data.catalog.block_code[block.kind] || { file: "", lines: [] };
  if (!ui.draft || ui.draft.id !== block.id) ui.draft = { id: block.id, config: { ...block.config } };
  const cfg = ui.draft.config;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(block.config);
  const rerender = () => renderInspector(block, state, data, ui, actions);
  const lines = templateLines(code.lines, spec.fields, cfg, (name) => fieldInput(spec.fields[name], name, cfg[name]));
  const res = resourcesOf(cfg, spec);
  const label = state.metrics.labels[block.id] || "";
  const isServer = block.kind === "server";
  const needsHost = !spec.external && !isServer;
  const servers = state.blocks.filter((b) => b.kind === "server");

  // Server tanlash (xizmat uchun) yoki server ichidagi xizmatlar ro'yxati (server uchun)
  let hostHtml = "";
  if (needsHost) {
    hostHtml = `<div class="host-row"><span>▣ Server:</span>
      <select id="hostSel">${block.host ? "" : `<option value="">— tanlang —</option>`}
        ${servers.map((s) => `<option value="${s.id}" ${s.id === block.host ? "selected" : ""}>${esc(s.name)} · ${esc(s.ip)}</option>`).join("")}
      </select></div>`;
  } else if (isServer) {
    const h = state.metrics.hosts[block.id];
    const tier = data.catalog.servers[block.config.tier];
    const inside = state.blocks.filter((b) => b.host === block.id);
    hostHtml = `<div class="srv-card">
      <div class="kv"><span>IP</span><b class="mono">${esc(block.ip)} ${block.config.public ? "(ochiq)" : "(ichki tarmoq)"}</b></div>
      <div class="kv small"><span>${esc(tier.title)}</span><span>$${tier.rent}/kun</span></div>
      <div class="kv small"><span>CPU</span><span>${h.cpu_used} / ${h.cpu_total} yadro</span></div>${bar(h.cpu_used, h.cpu_total)}
      <div class="kv small"><span>RAM</span><span>${fmt(h.ram_used)} / ${fmt(h.ram_total)} MB</span></div>${bar(h.ram_used, h.ram_total)}
      <div class="small muted">Ichida: ${inside.length ? inside.map((b) => `<button class="link" data-block="${b.id}">${esc(b.name)}</button>`).join(", ") : "hech narsa"}</div>
    </div>${serverAdvice(block, state, data, inside, h, tier)}`;
  }

  $("right").innerHTML = `
    <div class="row" style="justify-content:space-between">
      <input class="name-input" id="nameInp" value="${esc(block.name)}" maxlength="40" title="Blok nomi">
      <button class="btn small ghost" id="btnClose">✕</button></div>
    <div class="muted" style="margin:2px 0 4px"><b>${esc(spec.title)}</b> · ${esc(spec.about)}</div>
    ${hostHtml}
    <div class="res-pills">
      ${spec.external ? `<span class="pill">tashqi xizmat</span>` : isServer ? "" : `<span class="pill">${res.cpu} CPU</span><span class="pill">${res.ram} MB</span><span class="pill">${res.power} W</span>`}
      ${label && !isServer ? `<span class="pill">${esc(label)}</span>` : ""}
    </div>
    <div class="file-name">📄 ${esc(code.file)}</div>
    <div class="code" id="codeBox">${lines}</div>
    <div class="row end" style="margin-top:10px">
      ${spec.fixed ? "" : `<button class="btn danger" id="btnDel">O'chirish</button>`}
      ${Object.keys(spec.fields).length ? `<button class="btn primary" id="btnSave" ${dirty ? "" : "disabled"}>Saqlash · kommit</button>` : ""}
    </div>
    ${block.kind === "postgres" ? tablesHtml(state) : ""}
    ${isServer ? "" : requirementsHtml(block, state, data) + linksHtml(block, state)}
    ${spec.guide && data.guide[spec.guide] ? `<p><button class="link" data-guide="${spec.guide}">📖 ${esc(data.guide[spec.guide].title)}</button></p>` : ""}`;

  bindFields($("codeBox"), spec.fields, cfg, rerender);
  $("btnClose").onclick = () => actions.select(null);
  $("nameInp").onchange = (e) => actions.renameBlock(block.id, e.target.value);
  const del = $("btnDel");
  if (del) del.onclick = () => actions.deleteBlock(block.id);
  const save = $("btnSave");
  if (save) save.onclick = () => actions.saveConfig(block.id, { ...cfg });
  const hs = $("hostSel");
  if (hs) hs.onchange = () => hs.value && actions.setHost(block.id, Number(hs.value));
  $("right").querySelectorAll("[data-guide]").forEach((el) => el.onclick = () => actions.guide(el.dataset.guide));
  $("right").querySelectorAll("[data-block]").forEach((el) => el.onclick = () => actions.selectBlock(Number(el.dataset.block)));
  $("right").querySelectorAll("[data-unlink]").forEach((el) => el.onclick = () => actions.disconnect(Number(el.dataset.unlink)));
  $("right").querySelectorAll("[data-conn]").forEach((el) => el.onclick = () => {
    const [a, b] = el.dataset.conn.split(":").map(Number); actions.connect(a, b);
  });
  $("right").querySelectorAll("[data-addkind]").forEach((el) => el.onclick = () =>
    actions.addAt(el.dataset.addkind, el.dataset.host ? Number(el.dataset.host) : null));
  $("right").querySelectorAll("[data-movehere]").forEach((el) => el.onclick = () => {
    const [bid, hid] = el.dataset.movehere.split(":").map(Number); actions.setHost(bid, hid);
  });
  $("right").querySelectorAll("[data-delblock]").forEach((el) => el.onclick = () => actions.deleteBlock(Number(el.dataset.delblock)));
  $("right").querySelectorAll("[data-openfile]").forEach((el) => el.onclick = () => actions.openFile(el.dataset.openfile));
  const linkSel = $("linkTo");
  if (linkSel) linkSel.onchange = () => linkSel.value && actions.connect(block.id, Number(linkSel.value));
}

// Ulanishlar ro'yxati: kiruvchi/chiquvchi strelkalar + yangi strelka qo'shish.
// Ro'yxatda HAMMA bloklar bor — noto'g'risini tanlasangiz, sabab va oqibat ko'rsatiladi.
function linksHtml(block, state) {
  const name = (id) => state.blocks.find((x) => x.id === id)?.name || "?";
  const out = state.connections.filter((c) => c.source === block.id);
  const inc = state.connections.filter((c) => c.target === block.id);
  const linked = new Set(out.map((c) => c.target));
  const options = state.blocks.filter((b) => b.id !== block.id && !linked.has(b.id) && b.kind !== "server");
  const row = (c, other, arrow) => `<div class="kv"><span>${arrow} ${esc(name(other))}</span>
    <button class="link" data-unlink="${c.id}">uzish</button></div>`;
  const canOut = !["redis", "replica", "media", "payment"].includes(block.kind);
  return `<h3>Ulanishlar</h3>
    ${inc.map((c) => row(c, c.source, "←")).join("")}
    ${out.map((c) => row(c, c.target, "→")).join("")}
    ${!inc.length && !out.length ? `<p class="muted">Strelka yo'q.</p>` : ""}
    ${canOut && options.length ? `<div class="row" style="margin-top:4px"><span>→ ulash:</span>
      <select id="linkTo"><option value="">tanlang…</option>
      ${options.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></div>` : ""}`;
}

// "Bu blok ishlashi uchun" — ✓/✗ ro'yxat, yetishmagan strelka uchun bir bosishda ulash
function requirementsHtml(block, state, data) {
  const reqs = data.catalog.requirements[block.kind];
  if (!reqs) return "";
  const kindOf = (id) => state.blocks.find((b) => b.id === id)?.kind;
  const rows = reqs.map((r) => {
    const linked = state.connections.filter((c) => r.dir === "in"
      ? c.target === block.id && r.kinds.includes(kindOf(c.source))
      : c.source === block.id && r.kinds.includes(kindOf(c.target)));
    const ok = linked.length > 0;
    const linkedIds = new Set(linked.map((c) => (r.dir === "in" ? c.source : c.target)));
    const cands = state.blocks.filter((b) => r.kinds.includes(b.kind) && b.id !== block.id && !linkedIds.has(b.id));
    let actionsHtml = "";
    if (!ok || r.many) {
      actionsHtml = cands.map((b) => {
        const pair = r.dir === "in" ? `${b.id}:${block.id}` : `${block.id}:${b.id}`;
        const label = r.dir === "in" ? `${b.name} → ${block.name}` : `${block.name} → ${b.name}`;
        return `<button class="btn small" data-conn="${pair}">＋ ${esc(label)}</button>`;
      }).join("");
      if (!ok && !cands.length) {
        const k = r.kinds.find((x) => x !== "users");
        actionsHtml = k ? `<span class="muted">Hali ${esc(data.catalog.blocks[k].title)} yo'q —</span>
          <button class="btn small" data-addkind="${k}">＋ ${esc(data.catalog.blocks[k].title)} qo'shish</button>` : "";
      }
    }
    return `<div class="req ${ok ? "ok" : "no"}"><span class="req-mark">${ok ? "✓" : "✗"}</span>
      <div><div>${esc(r.text)}</div>${actionsHtml ? `<div class="req-acts">${actionsHtml}</div>` : ""}</div></div>`;
  }).join("");
  const label = state.metrics.labels[block.id];
  return `<h3>Ishlashi uchun kerak</h3>${rows}`;
}

// Server inspektori: bo'sh yoki to'lgan server bilan nima qilish mumkin
function serverAdvice(block, state, data, inside, h, tier) {
  const others = state.blocks.filter((b) => b.host && b.host !== block.id);
  const pick = (kind) => others.find((b) => b.kind === kind);
  const tips = [];
  if (!inside.length) {
    tips.push(`<p><b>Bu server bo'sh</b> — kuniga $${tier.rent} ijara + elektr yeydi, lekin hech narsa qilmaydi. Variantlar:</p>`);
    const pg = pick("postgres");
    if (pg) tips.push(`<div class="adv"><b>1. Bazani ajratish.</b> PostgreSQL alohida serverda — Sayt uchun CPU bo'shaydi.
      <button class="btn small" data-movehere="${pg.id}:${block.id}">🗄 ${esc(pg.name)} ni shu yerga ko'chirish</button></div>`);
    const lb = state.blocks.find((b) => b.kind === "lb");
    tips.push(`<div class="adv"><b>2. Saytni kengaytirish.</b> Shu serverga 2-Sayt qo'ying${lb ? "" : " va Load Balancer qo'shing"},
      keyin Nginx → LB → ikkala Sayt ulang.
      <div class="req-acts"><button class="btn small" data-addkind="app" data-host="${block.id}">＋ Shu serverga Sayt</button>
      ${lb ? "" : `<button class="btn small" data-addkind="lb">＋ Load Balancer</button>`}
      <button class="link" data-guide="lb">📖 qadamlar</button></div></div>`);
    ["worker", "redis", "tgbot"].forEach((k) => {
      const b = pick(k);
      if (b) tips.push(`<div class="adv"><button class="btn small" data-movehere="${b.id}:${block.id}">↪ ${esc(b.name)} ni shu yerga ko'chirish</button></div>`);
    });
    tips.push(`<div class="adv muted">Kerak bo'lmasa — o'chiring, pul tejaladi. <button class="btn small danger" data-delblock="${block.id}">Serverni o'chirish</button></div>`);
  } else if (h.over_cpu || h.over_ram) {
    tips.push(`<div class="tip bad">Server to'lib ketgan — undagi hamma blok sekinlashdi. Yuqoridagi "tur" ni kattaroq qiling
      yoki xizmatlardan birini boshqa serverga ko'chiring (xizmatni bosing → "▣ Server").</div>`);
  }
  return tips.length ? `<div class="srv-adv">${tips.join("")}</div>` : "";
}

// PostgreSQL inspektori: bazadagi jadvallar (Kod → Model quruvchi dan)
function tablesHtml(state) {
  const models = state.schema.models || [];
  return `<h3>Jadvallar</h3>
    <div class="kv small"><span class="mono">auth_user</span><span class="muted">Django</span></div>
    ${models.map((m) => `<div class="kv small"><span class="mono">app_${esc(m.name.toLowerCase())}</span>
      <span>${m.fields.length + 1} ustun</span></div>`).join("")}
    <button class="link" data-openfile="app/models.py">🗄 Model quruvchini ochish →</button>`;
}

function resourcesOf(cfg, spec) {
  let cpu = spec.cpu, ram = spec.ram_mb, power = spec.power_w;
  if (spec.per_unit) {
    const n = cfg[spec.per_unit.field] || 1;
    cpu += spec.per_unit.cpu * n; ram += spec.per_unit.ram_mb * n; power += spec.per_unit.power_w * n;
  }
  return { cpu: +cpu.toFixed(2), ram, power };
}

// -------------------------------------------------------------------------
// Kunlik grafik: chiziq — foydalanuvchilar, ustunlar — p95 (holat rangida)
// -------------------------------------------------------------------------
export function renderChart(state) {
  const h = state.history.slice(-30);
  const el = $("chart");
  if (!h.length) {
    el.innerHTML = `<div class="ch-empty">Birinchi o'yin kuni tugagach (20 daqiqa) bu yerda grafik paydo bo'ladi:
      foydalanuvchilar soni va har kungi foyda.</div>`;
    return;
  }
  const W = Math.max(260, Math.floor((el.clientWidth || 900) / 2) - 12), H = 150;
  const P = { l: 44, r: 10, t: 12, b: 22 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b, n = h.length;
  const step = iw / n;
  const xc = (i) => P.l + step * (i + 0.5);
  const days = h.map((d, i) => (n <= 10 || i % Math.ceil(n / 8) === 0 || i === n - 1)
    ? `<text x="${xc(i)}" y="${H - 6}" text-anchor="middle" class="ch-ax">${d.day}</text>` : "").join("");
  const grid = (y, label) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="ch-grid"/>
    <text x="${P.l - 6}" y="${y + 3}" text-anchor="end" class="ch-ax">${label}</text>`;

  // 1) foydalanuvchilar — maydonli chiziq
  const maxU = Math.max(10, ...h.map((d) => d.users));
  const yu = (v) => P.t + ih - (v / maxU) * ih;
  const pts = h.map((d, i) => [xc(i), yu(d.users)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${P.t + ih} L${pts[0][0].toFixed(1)},${P.t + ih} Z`;
  const col = { green: "#3fa456", yellow: "#e8a33a", red: "#d9577a", down: "#7d241d" };
  const dots = h.map((d, i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${n > 20 ? 2.5 : 3.5}" fill="${col[d.status] || "#999"}" stroke="#1d1b18" stroke-width="1">
    <title>Kun ${d.day}: ${fmt(d.users)} foydalanuvchi · p95 ${fmt(d.p95_ms)} ms · xato ${pct(d.error_rate)}</title></circle>`).join("");
  const users = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
    ${grid(yu(maxU), fmt(maxU))}${grid(yu(maxU / 2), fmt(Math.round(maxU / 2)))}${grid(yu(0), "0")}
    <path d="${area}" fill="#cfe3b2" opacity=".55"/>
    <path d="${line}" fill="none" stroke="#1d1b18" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${days}</svg>`;

  // 2) kunlik foyda — yashil/qizil ustunlar
  const nets = h.map((d) => Math.round((d.revenue - d.cost) * 10) / 10);
  const top = Math.max(1, ...nets), bot = Math.min(0, ...nets), span = top - bot || 1;
  const yn = (v) => P.t + ((top - v) / span) * ih;
  const bw = Math.max(3, Math.min(28, step * 0.7));
  const bars = nets.map((v, i) => {
    const y0 = yn(0), y1 = yn(v);
    return `<rect x="${(xc(i) - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}"
      rx="2" fill="${v >= 0 ? "#3fa456" : "#d9577a"}" opacity=".85">
      <title>Kun ${h[i].day}: daromad ${usd(h[i].revenue)} − xarajat ${usd(h[i].cost)} = ${usd(v, true)}</title></rect>`;
  }).join("");
  const money = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
    ${grid(yn(top), usd(top))}${bot < 0 ? grid(yn(bot), usd(bot)) : ""}
    <line x1="${P.l}" x2="${W - P.r}" y1="${yn(0)}" y2="${yn(0)}" stroke="#1d1b18" stroke-width="1"/>
    <text x="${P.l - 6}" y="${yn(0) + 3}" text-anchor="end" class="ch-ax">$0</text>
    ${bars}${days}</svg>`;

  const last = h[n - 1], sum = nets.reduce((x, y) => x + y, 0);
  el.innerHTML = `
    <div class="ch-box"><div class="ch-h"><b>👥 Foydalanuvchilar</b><span>${fmt(last.users)} · nuqta rangi = sayt holati</span></div>${users}</div>
    <div class="ch-box"><div class="ch-h"><b>💵 Kunlik foyda</b><span class="${sum >= 0 ? "pos" : "neg"}">${n} kunda ${usd(sum, true)}</span></div>${money}</div>`;
}

// -------------------------------------------------------------------------
// Git sahifasi — "kod qayerdan keldi, nima o'zgardi"
// -------------------------------------------------------------------------
export function renderGit(state) {
  const commits = state.commits.map((c) => `
    <div class="commit">
      <div class="commit-head"><span class="sha">${esc(c.sha)}</span><b>${esc(c.message)}</b>
        <span class="muted">kun ${c.day}${c.file ? " · " + esc(c.file) : ""}</span></div>
      ${c.diff.length ? `<div class="diff">${c.diff.map((l) => {
        const cls = l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
        return `<div class="${cls}">${esc(l) || " "}</div>`;
      }).join("")}</div>` : ""}
    </div>`).join("");
  const leaked = state.commits.some((c) => c.file === ".env" && c.diff.some((l) => l.includes("SECRET_KEY")));
  $("page-git").innerHTML = `
    <aside class="card">
      <h2>⎇ ${esc(state.room.name.toLowerCase().replace(/\s+/g, "-"))} / infra</h2>
      <p class="muted">Bu real Git emas — o'quv daftari. Doskadagi va Kod bo'limidagi har bir o'zgarish
      (blok, strelka, sozlama, sir) shu yerda kommit bo'lib qoladi.</p>
      ${leaked ? `<div class="tip warn">Tarixda <b>.env</b> fayli bor — undagi SECRET_KEY ochiq ko'rinadi.
        Faylni o'chirish yetmaydi: "Kod" bo'limida kalitni <b>almashtiring</b> va .env ni .gitignore ga qo'shing.</div>` : ""}
      <div class="tip info">Saboq: Git tarixi abadiy. Sir kommitga tushsa — yagona to'g'ri javob rotate.</div>
      <div class="kv"><span>Kommitlar</span><b>${state.commits.length}</b></div>
    </aside>
    <section class="card">${commits || '<p class="muted">Kommitlar yo\'q</p>'}</section>`;
}

// -------------------------------------------------------------------------
// Qo'llanma sahifasi
// -------------------------------------------------------------------------
// Qo'llanma sahifasi — o'rtada, bob tanlash chapda
// -------------------------------------------------------------------------
function guideBlock(b) {
  if (b.h) return `<h3 class="g-h">${esc(b.h)}</h3>`;
  if (b.p) return `<p>${esc(b.p)}</p>`;
  if (b.steps) return `<ol class="g-steps">${b.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
  if (b.list) return `<ul class="g-list">${b.list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (b.tip) return `<div class="g-tip">💡 ${esc(b.tip)}</div>`;
  if (b.warn) return `<div class="g-warn">⚠ ${esc(b.warn)}</div>`;
  if (b.code) return `<pre class="term">${b.code.map(esc).join("\n")}</pre>`;
  return "";
}

export function renderGuide(data, ui, actions) {
  const keys = Object.keys(data.guide);
  const current = ui.chapter && data.guide[ui.chapter] ? ui.chapter : keys[0];
  const ch = data.guide[current];
  const idx = keys.indexOf(current);
  const prev = keys[idx - 1], next = keys[idx + 1];
  $("page-guide").innerHTML = `
    <aside class="card g-nav"><h2>📖 Qo'llanma</h2>
      <p class="muted">Noldan to tayyor tizimgacha. Tartib bilan o'qing.</p>
      ${keys.map((k) => `<button class="chapter-btn ${k === current ? "active" : ""}" data-ch="${k}">${esc(data.guide[k].title)}</button>`).join("")}
    </aside>
    <section class="card g-main"><article class="g-article">
      <div class="eyebrow">${idx + 1} / ${keys.length}</div>
      <h1>${esc(ch.title)}</h1>
      ${ch.lead ? `<p class="g-lead">${esc(ch.lead)}</p>` : ""}
      ${(ch.body || []).map((b) => (typeof b === "string" ? `<p>${esc(b)}</p>` : guideBlock(b))).join("")}
      <div class="g-pager">
        ${prev ? `<button class="btn" data-ch="${prev}">← ${esc(data.guide[prev].title)}</button>` : "<span></span>"}
        ${next ? `<button class="btn primary" data-ch="${next}">${esc(data.guide[next].title)} →</button>` : ""}
      </div>
    </article></section>`;
  $("page-guide").querySelectorAll("[data-ch]").forEach((el) => el.onclick = () => { actions.guide(el.dataset.ch); window.scrollTo(0, 0); });
}
