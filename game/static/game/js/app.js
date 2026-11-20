// =========================================================================
// app.js — dastur markazi.
//   state  — serverdan kelgan to'liq holat (har amaldan keyin yangilanadi)
//   data   — o'zgarmas ma'lumot: katalog, qo'llanma, senariy (sahifaga joylangan)
//   ui     — faqat brauzerdagi holat: qaysi tab, nima tanlangan, avto-o'yin
// Har bir amal: api chaqiriladi -> yangi state -> render().
// =========================================================================
import { api } from "./api.js";
import { renderBoard, initBoard, freeSpot } from "./board.js";
import { renderStats, renderToolbar, renderRight, renderChart, renderGuide, renderRooms, esc } from "./panels.js";
import { renderGit } from "./git.js";
import { ico, hydrateIcons } from "./ui-icons.js";
import { renderCode } from "./code.js";
import { renderLaunchBar, openStep } from "./launch.js";
import { initLogs, logPush, onLog } from "./logs.js";
import { renderReport, usd } from "./report.js";
import { renderSite, drawFeed } from "./site.js";
import { renderLesson } from "./local.js";
import { renderWeb, openUrl } from "./web.js";
import { renderOwner } from "./owner.js";
import { renderGrowth } from "./growth.js";
import { startTour } from "./tour.js";
import { demoBuild } from "./demo.js";
import { FLOWS } from "./board.js";

const data = JSON.parse(document.getElementById("static-data").textContent);
const ui = { tab: "board", selected: null, draft: null, playing: false, chapter: null, tempEdge: null,
  file: "config/settings.py", search: "", line: null, reveal: null };
let state = null;
let busy = false;

const $ = (id) => document.getElementById(id);

// --- Xabar (toast). Xato bo'lsa — sabab va real hayotdagi oqibati ---------
let toastTimer = null;
function toast(msg, isError = false, effect = "") {
  const t = $("toast");
  t.innerHTML = `<div class="toast-msg">${ico(isError ? "alert" : "check", 15)}<span>${esc(msg)}</span></div>`
    + (effect ? `<div class="toast-effect"><b>Real hayotda:</b> ${esc(effect)}</div>` : "");
  t.className = "toast" + (isError ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), isError ? (effect ? 8000 : 5000) : 2500);
}

// --- Har bir amalni o'raydi: xato bo'lsa toast, bo'lmasa qayta chizish ---
// Amal kunlik pulni qanday o'zgartirdi — "nima qilsam nima bo'ladi"
function impact(prev, next) {
  if (!prev || !next || next.projected) return "";
  const dr = next.revenue - prev.revenue, dc = next.cost - prev.cost;
  if (Math.abs(dr) < 0.1 && Math.abs(dc) < 0.1) return "";
  const parts = [];
  if (Math.abs(dr) >= 0.1) parts.push(`daromad ${usd(dr, true)}`);
  if (Math.abs(dc) >= 0.1) parts.push(`xarajat ${dc > 0 ? "+" : "−"}$${Math.abs(dc).toFixed(1)}`);
  return `Kuniga: ${parts.join(", ")} → sof ${usd(prev.net, true)} ⇒ ${usd(next.net, true)}`;
}

async function run(promise, okMsg) {
  try {
    const prevFin = state && state.finance;
    const prevRoom = state && state.room.id;
    const res = await promise;
    absorb(res.state);
    const imp = prevRoom === res.state.room.id ? impact(prevFin, res.state.finance) : "";
    if (okMsg || res.message || imp) {
      const msg = [res.message || okMsg, imp].filter(Boolean).join(" · ");
      toast(msg);
      logPush("you", `siz  ${msg}`, "you");
    }
    (res.events || []).forEach((e) => {
      const good = e.startsWith("🎉");
      toast(e, !good);
      logPush(good ? "day" : "err", e, good ? "day-pos" : "err");
    });
    render();
    return res;
  } catch (e) {
    toast(e.message, true, e.effect);
    logPush("you", `siz  ✗ ${e.message}`, "err");
    // xatodan keyin ham holatni sinxronlaymiz (masalan, sudralgan blok joyiga qaytsin)
    try { absorb((await api.state()).state); render(); } catch {}
    return null;
  }
}

const title = (kind) => data.catalog.blocks[kind]?.title || kind;

// --- O'yinchi amallari ----------------------------------------------------
const actions = {
  select(sel) {
    ui.selected = sel;
    ui.draft = null;
    render();
  },
  selectBlock(id) {
    if (state.blocks.some((b) => b.id === id)) { ui.tab = "board"; actions.select({ type: "block", id }); }
  },
  move: (id, x, y) => run(api.moveBlock(id, x, y)),
  connect: (src, dst) => run(api.connect(src, dst), "Ulandi ✓"),
  disconnect: (id) => { ui.selected = null; run(api.disconnect(id), "Strelka o'chirildi"); },
  drop: async (kind, x, y) => {
    const res = await run(api.addBlock(kind, Math.max(0, x), Math.max(0, y)), `${title(kind)} qo'shildi`);
    if (res?.created) actions.select({ type: "block", id: res.created });
  },
  add: (kind) => { const p = freeSpot(state); actions.drop(kind, p.x, p.y); },
  addAt: async (kind, host) => {
    const p = freeSpot(state);
    const res = await run(api.addBlock(kind, p.x, p.y, host), `${title(kind)} qo'shildi`);
    if (res?.created) actions.select({ type: "block", id: res.created });
  },
  deleteBlock: (id) => { ui.selected = null; run(api.deleteBlock(id), "Blok o'chirildi"); },
  saveConfig: (id, config) => { ui.draft = null; run(api.configBlock(id, config), "Saqlandi · kommit yozildi"); },
  setHost: (id, host) => run(api.hostBlock(id, host), "Boshqa serverga ko'chirildi"),
  renameBlock: (id, name) => run(api.renameBlock(id, name)),
  power: () => run(api.power(), "Elektr limiti oshirildi"),
  buyGrowth: (kind, id) => run(api.growth(kind, id)),
  resume: () => run(api.resume()),
  withdraw: () => run(api.withdraw()),
  saveAdmin: (cfg) => { ui.djDraft = null; run(api.saveAdmin(cfg)); },
  tour: () => boardTour(),
  launchStep: (id) => {
    if (id === "local") { actions.tab("lesson"); return; }      // 0-qadam — alohida Dars sahifasi
    ui.tab = "board"; render(); openStep(id, state, data, actions);
  },
  toast: (m, err = true) => toast(m, err),
  openWeb: (url) => { openUrl(url); actions.closeModal(); actions.tab("web"); },
  saveOffers: async (offers) => {
    const res = await run(api.offers(offers));
    if (res) { ui.offerDraft = null; render(); }
  },
  // kod
  saveCode: (fields) => run(api.code(fields), "Kod saqlandi · kommit yozildi"),
  rotate: (key) => run(api.rotate(key), `${key || "Hamma sirlar"} almashtirildi`),
  openFile: (path) => { ui.file = path; ui.tab = "code"; render(); },
  saveModels: (models) => run(api.models(models)),
  dev: (task) => run(api.dev(task)),
  profile: (user) => run(api.profile(user)),
  web: (action, payload) => run(api.web(action, payload)),
  djadmin: (action, payload) => run(api.djadmin(action, payload)),
  launch: async (step, payload, reopen = false) => {
    const res = await run(api.launch(step, payload));
    if (res) { if (reopen) openStep(step, state, data, actions); else actions.closeModal(); }
    return res;
  },
  // xonalar
  openRoom: (id) => { ui.selected = null; ui.offerDraft = null; run(api.openRoom(id)); },
  newRoom: () => openNewRoomModal(),
  renameRoom: () => {
    const name = prompt("Startup nomi:", state.room.name);
    if (name) run(api.renameRoom(state.room.id, name), "Nomlandi");
  },
  deleteRoom: () => {
    if (!confirm(`"${state.room.name}" startupini o'chirasizmi? Bu qaytarilmaydi.`)) return;
    ui.selected = null;
    run(api.deleteRoom(state.room.id), "Startup o'chirildi");
  },
  refresh: () => api.state().then((r) => { absorb(r.state); render(); }).catch(() => {}),
  tab(name) {
    if (name === "owner" && !state?.me?.staff) name = "board";
    ui.tab = name;
    render();
  },
  guide(ch) { ui.chapter = ch; actions.tab("guide"); },
  closeModal: () => { $("modal").classList.add("hidden"); $("modalCard").className = "modal-card card"; },
};

// --- Yangi startup oynasi: 3 xil boshlash ------------------------------
//   scratch — noldan, dasturchidek (terminal: venv, startproject, startapp ...)
//   starter — tayyor shablon (kod va chizma bor, faqat 🚀)
//   bought  — ishlab turgan biznesni sotib olish (qurish shart emas)
const MODE_ICO = { scratch: "terminal", starter: "layers", bought: "store" };
const MODE_STEPS = {
  scratch: ["Terminal: papka, venv, Django", "startproject · startapp · static/media", "Server → domen → GitHub → deploy"],
  starter: ["Kod va chizma tayyor", "🚀 5 qadam: server → SSL", "Keyin o'zingiz kengaytirasiz"],
  bought: ["Domen, HTTPS, 300 mijoz", "Daromad darhol keladi", "Narx, reklama, o'sish"],
};

function modePickerHtml(selected = "scratch") {
  const coins = state ? state.room.coins : 0;
  return `<div class="mode-opts">${Object.entries(data.modes).map(([k, m]) => {
    const poor = m.price > coins;
    return `<label class="mode-opt ${poor ? "poor" : ""}">
      <input type="radio" name="nrMode" value="${k}" ${k === selected ? "checked" : ""} ${poor ? "disabled" : ""}>
      <span class="mode-ico">${ico(MODE_ICO[k], 22)}</span>
      <b>${esc(m.title)}</b>
      <span class="mode-price ${m.price ? "paid" : ""}">${m.price ? `$${m.price}` : "bepul"}</span>
      <span class="mode-text">${esc(m.text)}</span>
      <ul class="mode-steps">${MODE_STEPS[k].map((x) => `<li>${ico("check", 12)} ${esc(x)}</li>`).join("")}</ul>
      ${poor ? `<span class="mode-warn">Balansda $${Math.floor(coins)} — yetmaydi</span>` : ""}
    </label>`;
  }).join("")}</div>`;
}

function bizSelectHtml() {
  return `<select id="nrBiz">${Object.entries(data.catalog.businesses).map(([k, b]) =>
    `<option value="${k}">${b.icon} ${esc(b.title)} — ${esc(b.pitch)}</option>`).join("")}</select>`;
}

const MODE_DONE = { scratch: "Yangi g'oya — noldan. 0-qadam: terminal", starter: "Tayyor shablon ochildi", bought: "Biznes sotib olindi" };

function startMode(mode, name, biz) {
  ui.selected = null; ui.offerDraft = null; ui.tab = "board";
  return run(api.createRoom(mode, name, biz), MODE_DONE[mode]).then((res) => {
    if (!res) return;
    if (mode === "scratch") setTimeout(() => actions.tab("lesson"), 350);
    else if (mode === "starter") setTimeout(boardTour, 300);
  });
}

function openNewRoomModal() {
  $("modalCard").className = "modal-card card wide";
  $("modalCard").innerHTML = `
    <div class="md-head"><h2>${ico("sparkle", 20)} Yangi g'oya</h2>
      <button class="icon-btn" id="nrClose" title="Yopish">${ico("x", 16)}</button></div>
    <p class="muted">Har startup — alohida biznes: o'z serverlari, kodi, sayti, mijozlari va kassasi bilan.
      Balans esa <b>umumiy</b> (hozir ${usd(state.room.coins)}) — xarajatlar shu bitta hamyondan.</p>
    <div class="nr-row">
      <label class="field">Startup nomi <input id="nrName" maxlength="80" placeholder="masalan: MyDokon"></label>
      <label class="field">Biznes turi ${bizSelectHtml()}</label>
    </div>
    <h3>Qanday boshlaysiz?</h3>
    ${modePickerHtml()}
    <div class="row nr-foot">
      <button class="link" id="nrScenario" title="Ishlab turgan SaaS: 100 mijoz, maqsadlar va muammolar bilan">${ico("cap", 14)} yoki o'quv senariysi: SmetaPro</button>
      <span class="row"><button class="btn ghost" id="nrCancel">Bekor</button>
      <button class="btn primary" id="nrOk">Boshlash ${ico("arrowRight", 14)}</button></span></div>`;
  $("modal").classList.remove("hidden");
  $("nrName").focus();
  $("nrCancel").onclick = actions.closeModal;
  $("nrClose").onclick = actions.closeModal;
  $("nrScenario").onclick = () => {
    actions.closeModal();
    ui.selected = null; ui.offerDraft = null;
    run(api.createRoom("scenario", $("nrName").value || "SmetaPro"), "Senariy ochildi");
  };
  $("nrOk").onclick = () => {
    const mode = document.querySelector("input[name=nrMode]:checked")?.value || "scratch";
    const name = $("nrName").value, biz = $("nrBiz").value;
    actions.closeModal();
    startMode(mode, name, biz);
  };
}

// --- Birinchi tashrif: o'rgatish + tayyor kichik loyiha ------------------
const ONB_KEY = "vallum.onboarded";
function onbDone() { try { return localStorage.getItem(ONB_KEY) === "1"; } catch { return false; } }
function onbMark() { try { localStorage.setItem(ONB_KEY, "1"); } catch { /* bo'sh */ } }

const ONB_STEPS = [
  ["👋 Vallumga xush kelibsiz", `Bu yerda siz <b>startup</b> ochasiz va uning backend tizimini o'zingiz qurasiz —
    dasturlashni bilmasangiz ham. Tizim har qadamda nima qilishni ko'rsatadi.`],
  ["▦ Doska — tizim chizmasi", `Yuqoridagi paneldan bloklarni (<b>Nginx</b>, <b>Sayt</b>, <b>PostgreSQL</b>, <b>Avtorizatsiya</b>...)
    doskaga sudraysiz va <b>●</b> nuqtadan strelka tortib ulaysiz. Strelka — so'rov qayerga borishi.`],
  ["💳 Pul nimaga ketadi", `Dasturlar <b>bepul</b> — ular kod. Pul faqat <b>server ijarasi</b>, domen va tashqi xizmatlarga
    (to'lov 2%, SMS kodi $0.02) ketadi. Daromad — saytingiz mijozlari xaridlaridan.`],
  ["⏱ Vaqt real yuradi", `1 o'yin kuni = 20 daqiqa. Siz yo'qligingizda ham hisob yuradi.
    Lekin <b>3 kundan ortiq kirmasangiz sayt to'xtaydi</b> — egasiz biznes ishlamaydi.`],
  ["🚀 Qanday boshlaysiz?", `<b>Noldan</b> — dasturchidek: terminalda loyiha yaratasiz (eng ko'p o'rgatadi).
    <b>Tayyor shablon</b> — kod tayyor, faqat internetga chiqarasiz. <b>Sotib olish</b> — ishlab turgan biznes.`],
];

function maybeOnboard() {
  if (onbDone() || !state) return;
  let i = 0;
  const draw = () => {
    const [t, body] = ONB_STEPS[i], last = i === ONB_STEPS.length - 1;
    $("modalCard").innerHTML = `
      <div class="onb">
        <div class="onb-dots">${ONB_STEPS.map((_, k) => `<i class="${k === i ? "on" : k < i ? "done" : ""}"></i>`).join("")}</div>
        <h2>${t}</h2><p>${body}</p>
        ${last ? `<div class="nr-row"><label class="field">Startup nomi <input id="onbName" maxlength="80" value="Mening birinchi startupim"></label>
          <label class="field">Biznes turi ${bizSelectHtml()}</label></div>${modePickerHtml()}` : ""}
        <div class="row" style="justify-content:space-between">
          <button class="btn ghost" id="onbSkip">O'tkazib yuborish</button>
          <span class="row">${i ? `<button class="btn ghost" id="onbBack">← Orqaga</button>` : ""}
            ${last ? `<button class="btn ghost" id="onbDemo" title="Bo'sh doskadan boshlab, tizim o'zi bloklarni sudrab-ulab ko'rsatadi">${ico("film", 14)} Doskani qurib ko'rsat</button>` : ""}
            <button class="btn primary" id="onbNext">${last ? "Boshlash" : "Keyingi"} ${ico("arrowRight", 14)}</button></span>
        </div>
      </div>`;
    $("modalCard").className = "modal-card card" + (last ? " wide" : "");
    $("modal").classList.remove("hidden");
    $("onbSkip").onclick = () => { onbMark(); actions.closeModal(); };
    if (i) $("onbBack").onclick = () => { i--; draw(); };
    if (last) $("onbDemo").onclick = () => {
      const name = $("onbName").value || "Birinchi startup", key = $("nrBiz").value;
      onbMark(); actions.closeModal();
      ui.selected = null; ui.tab = "board";
      run(api.createRoom("sandbox", name, key), "Bo'sh startup ochildi — kuzating").then(() => setTimeout(() =>
        demoBuild({ actions, getState: () => state, onDone: (stopped) => {
          ui.tab = "board"; ui.selected = null; render();
          if (!stopped) toast("✓ Tizim tayyor! Endi o'zingiz: 🚀 qatoridagi qadamlarni bajaring");
          setTimeout(launchHint, 400);
        } }), 500));
    };
    $("onbNext").onclick = () => {
      if (!last) { i++; draw(); return; }
      const name = $("onbName").value || "Birinchi startup", key = $("nrBiz").value;
      const mode = document.querySelector("input[name=nrMode]:checked")?.value || "scratch";
      onbMark(); actions.closeModal();
      startMode(mode, name, key);
    };
  };
  draw();
}


// Ko'rsatmadan keyin: faqat 🚀 qadamini yoritib qo'yamiz
function launchHint() {
  startTour([{ el: ".lb-step.next", click: true, title: "Endi o'zingiz",
    text: `Tizim chizildi va kod tayyor. Saytni internetga chiqarish — 5 qadam. Sariq tugma — <b>hozir qilinadigan qadam</b>.
      Har qadamda terminal bor: buyruqni o'zingiz yozasiz, ▶ tugmasi esa yozib ko'rsatadi.` }]);
}

// --- Yo'riqnoma: xiralashtirib, kerakli joyni ko'rsatadi ------------------
function boardTour() {
  ui.tab = "board"; render();
  const deployed = state.launch.done.deploy;
  startTour([
    { el: "#board", title: "Sizning tizimingiz", text: state.blocks.length > 2
      ? `Bu — tizim chizmasi: <b>Foydalanuvchilar → Nginx → Sayt → PostgreSQL</b>, Saytga <b>To'lov shlyuzi</b> ulangan.
        Har blok bitta Server ichida ishlaydi. Blokni bossangiz — sozlamalari va kodi o'ngda ochiladi.`
      : `Doska hozircha bo'sh — faqat <b>Foydalanuvchilar</b>. Bloklarni o'zingiz qo'yib, strelkalar bilan ulaysiz.` },
    { el: "#toolbar", title: "Bloklar paneli", text: `Yangi qism kerak bo'lsa — shu yerdan doskaga sudrang va <b>●</b> nuqtadan strelka tortib ulang.
      Dasturlar bepul (kod), faqat Server ijarasi va tashqi xizmatlar pullik.` },
    { el: "#stats", title: "Holat qatori", text: deployed ? "Sayt holati, foydalanuvchilar, tezlik va xatolar shu yerda." :
      `Hozir <b>foydalanuvchi 0</b> — sayt hali internetda yo'q. <b>Deploy</b> qilinishi bilan birinchi <b>50 ta foydalanuvchi</b> keladi.` },
    { el: "#balance", title: "Balans va kassa", text: `Mijozlar to'lagan pul avval <b>To'lov shlyuzi kassasida</b> yig'iladi.
      Uni balansga o'tkazish uchun <b>💰 Yechib olish</b> tugmasini bosing — kirib turmasangiz pul kassada qoladi, ijara esa balansdan ketaveradi.` },
    { el: "#tabs", title: "Bo'limlar", text: `<b>Sayt</b> — saytingiz qanday ko'rinishi va narxlar, <b>O'sish</b> — reklama va yangi imkoniyatlar (SMS ham shu yerda),
      <b>Kod</b> — backend fayllari, <b>Qo'llanma</b> — har bir mavzu sodda tilda.` },
    { el: ".lb-step.next", click: true, title: "Birinchi vazifa", text: deployed ? "Keyingi qadam shu yerda ajratilgan — bosing va ko'rsatmaga amal qiling." :
      `Saytni internetga chiqarish 5 qadam: Server → Domen → GitHub → Deploy → SSL. Sariq tugma — <b>hozir qilinadigan qadam</b>. Bosing!` },
  ], { onDone: () => { try { localStorage.setItem("vallum.toured", "1"); } catch { /* bo'sh */ } } });
}

// --- Vaqt: o'yin real vaqtda yuradi --------------------------------------
// Server har so'rovda o'tgan vaqtni hisoblaydi (siz yo'qligingizda ham).
// Brauzer har 5 soniyada holatni so'raydi va soatni har soniya yangilaydi.
let clockBase = null;      // {day, hour, at}
function tickClock() {
  if (!state || !clockBase) return;
  const hs = state.clock.hour_seconds * 1000;
  const passed = Math.floor((Date.now() - clockBase.at) / hs);
  const total = clockBase.hour + passed;
  const day = clockBase.day + Math.floor(total / 24), hour = total % 24;
  $("dayChip").innerHTML = `Kun ${day} · ${String(hour).padStart(2, "0")}:00 ${state.suspended ? "<b class='neg'>⛔</b>" : state.neglected ? "<b class='neg'>⏸</b>" : "<span class='live-dot'></span>"}`;
}

function showAway(a) {
  const h = a.hours, d = Math.floor(h / 24), hh = h % 24;
  $("modalCard").innerHTML = `
    <h2>👋 Siz yo'qligingizda</h2>
    <p class="muted">O'yinda <b>${d ? `${d} kun ` : ""}${hh} soat</b> o'tdi${a.capped ? " (uzoq yo'qlik — ko'pi bilan 7 kun hisoblanadi)" : ""}. Tizim o'zi ishladi:</p>
    <div class="fin">
      <div class="fin-row in"><span>Daromad</span><b>${usd(a.revenue, true)}</b></div>
      <div class="fin-row out"><span>Xarajat (server ijarasi, xizmatlar, tannarx)</span><b>${usd(-a.cost)}</b></div>
      <div class="fin-row total ${a.net >= 0 ? "pos" : "neg"}"><span>Sof natija</span><b>${usd(a.net, true)}</b></div>
      <div class="fin-row"><span>Balans</span><b>${usd(a.from.coins)} → ${usd(a.to.coins)}</b></div>
      <div class="fin-row"><span>Mijozlar</span><b>${a.from.users} → ${a.to.users}</b></div>
    </div>
    ${state.neglected ? `<div class="tip bad">⏸ Siz uzoq kirmadingiz — sayt to'xtadi, ijara esa to'lanib turdi. Saytni qayta yoqing va tez-tez kirib turing.</div>` : ""}
    ${a.suspended_at ? `<div class="tip bad">⛔ ${esc(a.suspended_at)} da balans tugadi — hosting serverlarni to'xtatdi. Xarajatni kamaytirib, qayta yoqing.</div>` : ""}
    ${a.events.length ? `<h3>Nima bo'ldi</h3>${a.events.map((e) => `<div class="gr-ev ${e.startsWith("🎉") ? "good" : "bad"}">${esc(e)}</div>`).join("")}` : ""}
    <div class="row end"><button class="btn primary" id="awayOk">Tushunarli</button></div>`;
  $("modal").classList.remove("hidden");
  $("awayOk").onclick = actions.closeModal;
}

// Yangi holat keldi: hodisalar, kun yakunlari, offlayn xulosa
function absorb(next) {
  const prevDay = state && state.room.id === next.room.id && state.history.length ? state.history[state.history.length - 1].day : null;
  state = next;
  clockBase = { day: next.clock.day, hour: next.clock.hour, at: Date.now() };
  if (prevDay !== null) {
    next.history.filter((d) => d.day > prevDay).forEach((d) => logPush("day",
      `── Kun ${d.day} yakuni: ${d.users} mijoz${d.orders ? ` · ${d.orders} sotuv` : ""} · daromad ${usd(d.revenue, true)} · xarajat ${usd(-d.cost)} · sof ${usd(d.revenue - d.cost, true)} · balans ${usd(d.coins)}`,
      d.revenue - d.cost >= 0 ? "day-pos" : "day-neg"));
  }
  (next.sync_events || []).forEach((e) => {
    const good = e.startsWith("🎉");
    if (!next.away) toast(e, !good);
    logPush(good ? "day" : "err", e, good ? "day-pos" : "err");
  });
  if (next.away) showAway(next.away);
}

let pointerDown = false;
async function poll() {
  if (busy || document.hidden || !state) return;
  try {
    const res = await api.state();
    absorb(res.state);
    // foydalanuvchi yozayotgan / sudrayotgan / oyna ochiq bo'lsa — faqat yuqori qatorni yangilaymiz
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    const modalOpen = !$("modal").classList.contains("hidden");
    if (typing || modalOpen || pointerDown || ui.draft || ui.offerDraft) renderStats(state, actions);
    else render();
  } catch {}
}

// --- Chizish --------------------------------------------------------------
function render() {
  if (!state) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === ui.tab));
  ["board", "lesson", "web", "site", "growth", "report", "code", "git", "guide", "owner"].forEach((p) => $("page-" + p).classList.toggle("hidden", ui.tab !== p));
  document.querySelectorAll(".staff-only").forEach((el) => el.classList.toggle("hidden", !state.me?.staff));
  $("meEmail").textContent = state.me?.email || "";
  renderStats(state, actions);
  renderRooms(state, actions);
  $("roomTitle").textContent = state.room.name;
  $("scenarioTitle").textContent = state.room.kind === "scenario" ? data.scenario.title
    : (() => { const b = data.catalog.businesses[state.business?.key] || {}; return `${b.icon || "💡"} ${b.title || "Startup"} · tizim doskasi`; })();

  if (ui.tab === "board") {
    renderToolbar(state, data.catalog, actions);
    renderLaunchBar(state, data, actions);
    renderBoard({ state, catalog: data.catalog, ui, actions });
    renderRight(state, data, ui, actions);
    renderChart(state);
  } else if (ui.tab === "code") {
    renderCode(state, data, ui, actions);
  } else if (ui.tab === "growth") {
    renderGrowth(state, data, actions);
  } else if (ui.tab === "site") {
    renderSite(state, data, ui, actions);
  } else if (ui.tab === "report") {
    renderReport(state, actions);
  } else if (ui.tab === "git") {
    renderGit(state, data, ui, actions);
  } else if (ui.tab === "guide") {
    renderGuide(data, ui, actions);
  } else if (ui.tab === "web") {
    renderWeb(state, data, ui, actions);
  } else if (ui.tab === "lesson") {
    renderLesson(state, data, ui, actions);
  } else if (ui.tab === "owner") {
    renderOwner(state, actions);
  }
}

// --- Ishga tushirish ------------------------------------------------------
function bindTopbar() {
  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) { actions.tab(t.dataset.tab); window.scrollTo({ top: 0 }); }
    if (e.target.closest("#navFold")) {                   // yon panelni ixchamlash (faqat ikonlar)
      document.body.classList.toggle("nav-mini");
      try { localStorage.setItem("vallum.navmini", document.body.classList.contains("nav-mini") ? "1" : ""); } catch { /* bo'sh */ }
    }
  });
  try { if (localStorage.getItem("vallum.navmini")) document.body.classList.add("nav-mini"); } catch { /* bo'sh */ }
  $("btnReset").onclick = () => {
    if (!confirm("Startupni boshidan boshlaysizmi? Undagi hamma o'zgarishlar o'chadi.")) return;
    ui.selected = null;
    run(api.reset(), "Startup qaytadan boshlandi");
  };
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") actions.closeModal(); });
  $("btnTour").onclick = actions.tour;
  // kassadan yechish — qayerda bo'lsa ham (yuqori panel, moliya kartasi, To'lov bloki)
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-withdraw]")) actions.withdraw();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") actions.closeModal();
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing || ui.tab !== "board" || !ui.selected) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      if (ui.selected.type === "block") actions.deleteBlock(ui.selected.id);
      else actions.disconnect(ui.selected.id);
    }
  });
}

hydrateIcons();
bindTopbar();
$("legendFlows").innerHTML = Object.values(FLOWS).map((f) =>
  `<span class="lg-flow" title="${f.title}"><i style="background:${f.color}"></i>${f.label}</span>`).join("");
initBoard();
initLogs(() => state);
setInterval(poll, 5000);
setInterval(tickClock, 1000);
document.addEventListener("pointerdown", () => { pointerDown = true; });
document.addEventListener("pointerup", () => { pointerDown = false; });
onLog((l) => { if (l.kind === "money" && ui.tab === "site") drawFeed(); });
run(api.state()).then(maybeOnboard);
