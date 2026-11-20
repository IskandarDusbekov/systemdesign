// =========================================================================
// owner.js — 🛠 Boshqaruv (faqat o'yin egasi / staff): o'yinchilar va hamyonlar,
// startuplar va vaqt, domenlar, serverlar, G'AZNA (domen va server puli).
// =========================================================================
import { call } from "./api.js";
import { ico } from "./ui-icons.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const KIND = { domain: "Domen", server: "Server", rent: "Server ijarasi" };

let data = null, loading = false, sec = "treasury";

async function load(body) {
  loading = true;
  try {
    const r = body ? await call("POST", "/api/owner", body) : await call("GET", "/api/owner");
    data = r.owner;
    return r.message;
  } finally { loading = false; }
}

export function renderOwner(state, actions) {
  const root = $("page-owner");
  if (!state.me?.staff) { root.innerHTML = `<div class="card ow-empty">Bu bo'lim faqat o'yin egasi uchun.</div>`; return; }
  if (!data) {
    root.innerHTML = `<div class="card ow-empty">Yuklanmoqda…</div>`;
    if (!loading) load().then(() => renderOwner(state, actions)).catch((e) => actions.toast(e.message));
    return;
  }
  const t = data.treasury;
  const tabs = [["treasury", "G'azna"], ["users", `O'yinchilar · ${data.users.length}`], ["rooms", `Startuplar · ${data.rooms.length}`],
    ["domains", `Domenlar · ${data.domains.length}`], ["servers", `Serverlar · ${data.servers.length}`]];
  root.innerHTML = `
    <div class="ow">
      <div class="ow-head">
        <div><h1>${ico("shield", 18)} Boshqaruv</h1><p class="muted">O'yin egasi paneli: o'yinchilar, vaqt, domenlar, serverlar va ulardan tushgan pul.</p></div>
        <button class="btn ghost" id="owReload">${ico("reset", 13)} Yangilash</button>
      </div>
      <div class="ow-kpi">
        <div class="card"><span>G'azna jami</span><b>${money(t.total)}</b></div>
        <div class="card"><span>Domenlardan</span><b>${money(t.by_kind.domain)}</b></div>
        <div class="card"><span>Server ijarasi</span><b>${money((t.by_kind.rent || 0) + (t.by_kind.server || 0))}</b></div>
        <div class="card"><span>To'lovlar soni</span><b>${t.recent.length}${t.recent.length >= 40 ? "+" : ""}</b></div>
      </div>
      <div class="ow-tabs">${tabs.map(([k, l]) => `<button class="${sec === k ? "on" : ""}" data-sec="${k}">${l}</button>`).join("")}</div>
      <div class="card ow-body">${body()}</div>
    </div>`;
  root.querySelectorAll("[data-sec]").forEach((b) => b.onclick = () => { sec = b.dataset.sec; renderOwner(state, actions); });
  $("owReload").onclick = () => load().then(() => renderOwner(state, actions)).catch((e) => actions.toast(e.message));
  const doAct = (payload, ask) => {
    if (ask && !confirm(ask)) return;
    load(payload).then((msg) => { actions.toast(msg || "Bajarildi", false); renderOwner(state, actions); actions.refresh(); })
      .catch((e) => actions.toast(e.message));
  };
  root.querySelectorAll("[data-time]").forEach((b) => b.onclick = () => doAct({ action: "time", room: +b.dataset.room, hours: +b.dataset.time }));
  root.querySelectorAll("[data-bal]").forEach((b) => b.onclick = () => {
    const v = prompt("Yangi balans ($):", b.dataset.cur);
    if (v !== null && v.trim() !== "") doAct({ action: "balance", user: +b.dataset.bal, amount: Number(v) });
  });
  root.querySelectorAll("[data-uadd]").forEach((b) => b.onclick = () =>
    doAct({ action: "users", room: +b.dataset.room, users: +b.dataset.cur + +b.dataset.uadd }));
  root.querySelectorAll("[data-uset]").forEach((b) => b.onclick = () => {
    const v = prompt(`${b.dataset.name}: mijozlar soni (0 — 1 000 000):`, b.dataset.cur);
    if (v !== null && v.trim() !== "") doAct({ action: "users", room: +b.dataset.uset, users: Math.round(Number(v)) });
  });
  root.querySelectorAll("[data-free]").forEach((b) => b.onclick = () => doAct({ action: "release_domain", room: +b.dataset.free },
    `${b.dataset.name} domenini bo'shatasizmi? Sayt bu domen orqali ochilmay qoladi.`));
  root.querySelectorAll("[data-delsrv]").forEach((b) => b.onclick = () => doAct({ action: "delete_server", block: +b.dataset.delsrv },
    `${b.dataset.name} serverini o'chirasizmi?`));
}

function table(head, rows, empty) {
  if (!rows.length) return `<div class="ow-empty muted">${empty}</div>`;
  return `<div class="ow-scroll"><table class="ow-t"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody></table></div>`;
}

function body() {
  const d = data;
  if (sec === "users") {
    return table(["Email", "Startup", "Balans", "Ro'yxat", "Oxirgi kirish", ""], d.users.map((u) => `<tr>
      <td>${esc(u.email)} ${u.staff ? `<span class="ow-tag">egasi</span>` : ""}</td><td>${u.rooms}</td><td class="mono">${money(u.balance)}</td>
      <td>${u.joined}</td><td>${u.last}</td>
      <td><button class="btn mini" data-bal="${u.id}" data-cur="${u.balance}">Balans</button></td></tr>`), "O'yinchi yo'q");
  }
  if (sec === "rooms") {
    return table(["Startup", "Egasi", "Vaqt", "Mijoz", "Kassa", "Vaqtni surish"], d.rooms.map((r) => `<tr>
      <td>${esc(r.name)} ${r.suspended ? `<span class="ow-tag bad">to'xtagan</span>` : ""}</td><td>${esc(r.owner)}</td>
      <td class="mono">Kun ${r.day} · ${String(r.hour).padStart(2, "0")}:00</td>
      <td class="ow-acts"><span class="mono">${r.users}</span>
        <button class="btn mini" data-uadd="100" data-room="${r.id}" data-cur="${r.users}" title="+100 mijoz">+100</button>
        <button class="btn mini" data-uset="${r.id}" data-cur="${r.users}" data-name="${esc(r.name)}" title="Aniq sonni kiritish">${ico("edit", 12)}</button></td><td class="mono">${money(r.kassa)}</td>
      <td class="ow-acts"><button class="btn mini" data-time="1" data-room="${r.id}">+1 soat</button>
        <button class="btn mini" data-time="24" data-room="${r.id}">+1 kun</button>
        <button class="btn mini" data-time="168" data-room="${r.id}">+7 kun</button></td></tr>`), "Startup yo'q");
  }
  if (sec === "domains") {
    return table(["Domen", "A yozuvi", "HTTPS", "Startup", "Egasi", ""], d.domains.map((x) => `<tr>
      <td class="mono">${esc(x.domain)}</td><td class="mono">${esc(x.ip || "—")}</td><td>${x.ssl ? "ha" : "yo'q"}</td>
      <td>${esc(x.room_name)}</td><td>${esc(x.owner)}</td>
      <td><button class="btn mini danger" data-free="${x.room}" data-name="${esc(x.domain)}">Bo'shatish</button></td></tr>`), "Hali hech kim domen olmagan");
  }
  if (sec === "servers") {
    return table(["Server", "IP", "Tarif", "Kunlik", "Dasturlar", "Startup", "Egasi", ""], d.servers.map((s) => `<tr>
      <td>${esc(s.name)}</td><td class="mono">${esc(s.ip)}</td><td>${esc(s.tier)}</td><td class="mono">${money(s.rent)}</td>
      <td>${s.apps}</td><td>${esc(s.room_name)}</td><td>${esc(s.owner)}</td>
      <td><button class="btn mini danger" data-delsrv="${s.id}" data-name="${esc(s.name)}" ${s.apps ? "disabled title='Avval ichidagi dasturlarni o‘chiring'" : ""}>O'chirish</button></td></tr>`), "Server yo'q");
  }
  return `<p class="muted ow-note">O'yinchilar domen sotib olganda, server ijaraga olganda va har soatlik ijara to'laganda pul shu yerga — alohida g'aznaga tushadi.</p>` +
    table(["Vaqt", "Turi", "Summa", "O'yinchi", "Startup", "Izoh"], d.treasury.recent.map((e) => `<tr>
      <td class="mono">${e.at}</td><td><span class="ow-k ${e.kind}">${KIND[e.kind] || e.kind}</span></td><td class="mono">${money(e.amount)}</td>
      <td>${esc(e.who)}</td><td>${esc(e.room)}</td><td>${esc(e.note)}</td></tr>`), "G'azna hozircha bo'sh");
}
