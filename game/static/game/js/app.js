// =========================================================================
// app.js — dastur markazi.
//   state  — serverdan kelgan to'liq holat (har amaldan keyin yangilanadi)
//   data   — o'zgarmas ma'lumot: katalog, qo'llanma, senariy (sahifaga joylangan)
//   ui     — faqat brauzerdagi holat: qaysi tab, nima tanlangan, avto-o'yin
// Har bir amal: api chaqiriladi -> yangi state -> render().
// =========================================================================
import { api } from "./api.js";
import { renderBoard, initBoard, freeSpot } from "./board.js";
import { renderStats, renderToolbar, renderRight, renderChart, renderGit, renderGuide, renderRooms, esc } from "./panels.js";
import { renderCode } from "./code.js";
import { renderLaunchBar, openStep } from "./launch.js";
import { initLogs, logPush, onLog } from "./logs.js";
import { renderReport, usd } from "./report.js";
import { renderSite, drawFeed } from "./site.js";
import { renderGrowth } from "./growth.js";

const data = JSON.parse(document.getElementById("static-data").textContent);
const ui = { tab: "board", selected: null, draft: null, playing: false, chapter: null, tempEdge: null,
  file: "config/settings.py", search: "", line: null, reveal: null };
let state = null;
let timer = null;
let busy = false;

const $ = (id) => document.getElementById(id);

// --- Xabar (toast). Xato bo'lsa — sabab va real hayotdagi oqibati ---------
let toastTimer = null;
function toast(msg, isError = false, effect = "") {
  const t = $("toast");
  t.innerHTML = esc(msg) + (effect ? `<div class="toast-effect">⚠ Real hayotda: ${esc(effect)}</div>` : "");
  t.className = "toast" + (isError ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), isError ? (effect ? 8000 : 5000) : 2500);
}

// --- Har bir amalni o'raydi: xato bo'lsa toast, bo'lmasa qayta chizish ---
async function run(promise, okMsg) {
  try {
    const res = await promise;
    state = res.state;
    if (okMsg || res.message) { toast(res.message || okMsg); logPush("you", `siz  ${res.message || okMsg}`, "you"); }
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
    try { state = (await api.state()).state; render(); } catch {}
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
  saveOffers: async (offers) => {
    const res = await run(api.offers(offers));
    if (res) { ui.offerDraft = null; render(); }
  },
  // kod
  saveCode: (fields) => run(api.code(fields), "Kod saqlandi · kommit yozildi"),
  rotate: (key) => run(api.rotate(key), `${key || "Hamma sirlar"} almashtirildi`),
  openFile: (path) => { ui.file = path; ui.tab = "code"; render(); },
  saveModels: (models) => run(api.models(models)),
  launch: async (step, payload, reopen = false) => {
    const res = await run(api.launch(step, payload));
    if (res) { if (reopen) openStep(step, state, data, actions); else actions.closeModal(); }
    return res;
  },
  // xonalar
  openRoom: (id) => { stopPlay(); ui.selected = null; ui.offerDraft = null; run(api.openRoom(id)); },
  newRoom: () => openNewRoomModal(),
  renameRoom: () => {
    const name = prompt("Xona nomi:", state.room.name);
    if (name) run(api.renameRoom(state.room.id, name), "Nomlandi");
  },
  deleteRoom: () => {
    if (!confirm(`"${state.room.name}" xonasini o'chirasizmi? Bu qaytarilmaydi.`)) return;
    stopPlay(); ui.selected = null;
    run(api.deleteRoom(state.room.id), "Xona o'chirildi");
  },
  tab(name) {
    ui.tab = name;
    render();
  },
  guide(ch) { ui.chapter = ch; actions.tab("guide"); },
  closeModal: () => $("modal").classList.add("hidden"),
};

// --- Yangi xona oynasi ----------------------------------------------------
function openNewRoomModal() {
  const biz = data.catalog.businesses;
  $("modalCard").innerHTML = `
    <h2>🚀 Yangi startup</h2>
    <p class="muted">Har xona — alohida biznes: o'z serverlari, kodi, sayti, mijozlari va puli bilan.</p>
    <label class="field">Startup nomi <input id="nrName" maxlength="80" placeholder="masalan: MyDokon"></label>
    <h3>Qanday biznes ochasiz?</h3>
    <div class="biz-opts">${Object.entries(biz).map(([k, b], i) => `
      <label class="biz-opt"><input type="radio" name="nrBiz" value="${k}" ${i === 0 ? "checked" : ""}>
        <span class="biz-ico">${b.icon}</span><b>${esc(b.title)}</b>
        <span>${esc(b.pitch)}</span><span class="muted small">🧩 ${esc(b.learn)}</span>
        <span class="small">Boshlang'ich: ${b.offers.map((o) => `${o.emoji} ${esc(o.name)} $${o.price}`).join(" · ")}</span></label>`).join("")}
    </div>
    ${state.room.coins >= 100 ? `<label class="field">Sarmoya: "${esc(state.room.name)}" hisobidan (hozir ${usd(state.room.coins)})
      <select id="nrInvest">${[0, 250, 500, 1000, 2500, 5000].filter((v) => v <= state.room.coins).map((v) =>
        `<option value="${v}">${v ? `${usd(v)} — yangi startupga boshlang'ich kapital` : "sarmoyasiz (standart kapital)"}</option>`).join("")}</select></label>` : ""}
    <label class="kind-opt" style="margin-top:10px"><input type="checkbox" id="nrScenario">
      <b>Yoki tayyor senariy: SmetaPro</b><span>Ishlab turgan kichik SaaS, maqsadlar va maslahatlar bilan (biznes tanlovi e'tiborga olinmaydi).</span></label>
    <div class="row end"><button class="btn ghost" id="nrCancel">Bekor</button>
      <button class="btn primary" id="nrOk">Startupni ochish</button></div>`;
  $("modal").classList.remove("hidden");
  $("nrName").focus();
  $("nrCancel").onclick = actions.closeModal;
  $("nrOk").onclick = () => {
    const scenario = $("nrScenario").checked;
    const key = document.querySelector("input[name=nrBiz]:checked").value;
    actions.closeModal();
    stopPlay(); ui.selected = null; ui.offerDraft = null;
    const invest = Number($("nrInvest")?.value || 0);
    run(api.createRoom(scenario ? "scenario" : "sandbox", $("nrName").value, key, invest),
      invest ? `Startup ochildi · ${usd(invest)} sarmoya kiritildi` : "Startup ochildi");
  };
}

// --- Vaqt: avto-o'yin (1 soniya = 1 kun) ---------------------------------
// Pul minusga ketayotgan bo'lsa — kun o'tkazishdan oldin ogohlantiramiz
function moneyGuard(days, auto) {
  const f = state.finance;
  if (state.room.neg_streak >= f.bankrupt_days) {
    toast("Startup bankrot bo'lgan. ↺ bilan xonani qaytadan boshlang.", true);
    return false;
  }
  if (f.net >= 0) { ui.ack = null; return true; }
  const after = state.room.coins + f.net * days;
  if (after >= 0 || ui.ack === state.room.id) return true;
  if (auto) {
    stopPlay();
    toast(`To'xtatildi: har kuni ${usd(f.net, true)}, balans minusga ketadi. ${f.revenue_why}. O'ngdagi 💰 Moliyani qarang.`, true);
    return false;
  }
  const ok = confirm(`Diqqat, pul tugayapti!\n\nDaromad: ${usd(f.revenue, true)} (${f.revenue_why})\nXarajat: ${usd(-f.cost)}\nHar kuni: ${usd(f.net, true)}\n\n` +
    `${days} kundan keyin balans: ${usd(after)}.\n${f.bankrupt_days} kun ketma-ket minusda bo'lsa — bankrot.\n\nBaribir davom etasizmi?`);
  if (ok) ui.ack = state.room.id;
  return ok;
}

async function tick(days, auto = false) {
  if (busy) return;
  if (!moneyGuard(days, auto)) return;
  busy = true;
  const before = state.history.length ? state.history[state.history.length - 1].day : 0;
  const res = await run(api.tick(days));
  busy = false;
  // kun yakunlari logga: kim qancha keltirdi, qancha ketdi
  (res?.state.history || []).filter((d) => d.day > before).forEach((d) => logPush("day",
    `── Kun ${d.day} yakuni: ${d.users} mijoz${d.orders ? ` · ${d.orders} sotuv` : ""} · daromad ${usd(d.revenue, true)} · xarajat ${usd(-d.cost)} · sof ${usd(d.revenue - d.cost, true)} · balans ${usd(d.coins)}`,
    d.revenue - d.cost >= 0 ? "day-pos" : "day-neg"));
  if (res?.events?.length) stopPlay();
}
function startPlay() {
  ui.playing = true;
  $("btnPlay").textContent = "⏸ Pauza";
  timer = setInterval(() => tick(1, true), 1000);
}
function stopPlay() {
  ui.playing = false;
  $("btnPlay").textContent = "▶ Boshlash";
  clearInterval(timer);
}

// --- Chizish --------------------------------------------------------------
function render() {
  if (!state) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === ui.tab));
  ["board", "site", "growth", "report", "code", "git", "guide"].forEach((p) => $("page-" + p).classList.toggle("hidden", ui.tab !== p));
  renderStats(state);
  renderRooms(state, actions);
  $("roomTitle").textContent = `${state.room.name} · serverxona`;
  $("scenarioTitle").textContent = state.room.kind === "scenario" ? data.scenario.title : "Bo'sh xona · noldan qurish";

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
    renderGit(state);
  } else if (ui.tab === "guide") {
    renderGuide(data, ui, actions);
  }
}

// --- Ishga tushirish ------------------------------------------------------
function bindTopbar() {
  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) actions.tab(t.dataset.tab);
  });
  $("btnPlay").onclick = () => (ui.playing ? stopPlay() : startPlay());
  $("btnDay").onclick = () => tick(1);
  $("btnWeek").onclick = () => tick(7);
  $("btnReset").onclick = () => {
    if (!confirm("Xonani boshidan boshlaysizmi? Undagi hamma o'zgarishlar o'chadi.")) return;
    stopPlay();
    ui.selected = null;
    run(api.reset(), "Xona qaytadan boshlandi");
  };
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") actions.closeModal(); });
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

bindTopbar();
initBoard();
initLogs(() => state);
onLog((l) => { if (l.kind === "money" && ui.tab === "site") drawFeed(); });
run(api.state());
