// =========================================================================
// growth.js — 📈 O'sish sahifasi: foydani nimaga sarflash.
//   * faol ta'sirlar (kampaniyalar, hodisalar) va ularning kuchi;
//   * marketing kampaniyalari (vaqtinchalik) va yangi imkoniyatlar (doimiy);
//   * hodisalar tarixi, yutuqlar, barcha startuplar portfeli, yangi startup.
// =========================================================================
import { esc } from "./tpl.js";
import { usd } from "./report.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const pct = (x) => `${x >= 1 ? "+" : "−"}${Math.round(Math.abs(x - 1) * 100)}%`;

function effectLine(spec) {
  const parts = [];
  if (spec.growth) parts.push(`mijoz ${spec.growth > 0 ? "+" : "−"}${+(Math.abs(spec.growth) * 100).toFixed(1)}%/kun`);
  if (spec.demand && spec.demand !== 1) parts.push(`sotuv ${pct(spec.demand)}`);
  if (spec.traffic && spec.traffic !== 1) parts.push(`trafik ${spec.traffic}×`);
  return parts.join(" · ");
}

export function renderGrowth(state, data, actions) {
  const g = state.growth, cat = data.catalog.growth, coins = state.room.coins;
  const live = state.launch.domain && state.launch.done.deploy;
  const sys = state.metrics.status;
  const active = [
    ...g.campaigns.map((c) => ({ ...cat.marketing[c.id], days_left: c.days_left, kind: "📣" })),
    ...g.effects.map((e) => ({ ...e, icon: "", kind: "⚡" })),
  ];
  const doneAch = g.achievements.filter((a) => a.done).length;

  $("page-growth").innerHTML = `
  <section class="card gr">
    <div class="rp-head">
      <div><h1>📈 O'sish — foydani ishlatish</h1>
        <p class="muted">Pul yig'ilib turishi kam: uni mijoz ko'paytirish, sotuvni oshirish va tizimni himoya qilishga sarflang.
          Har qaror — tavakkal: reklama trafikni oshiradi, tizim chidamasa pul havoga ketadi.</p></div>
      <div class="gr-bal">Hisobda <b>${usd(coins)}</b><span class="${state.finance.net >= 0 ? "pos" : "neg"}">bugun ${usd(state.finance.net, true)}</span></div>
    </div>

    ${active.length ? `<div class="gr-active">${active.map((a) => `<div class="gr-chip">${a.kind} ${esc(a.icon || "")} <b>${esc(a.title)}</b>
      <span>${effectLine(a)}</span><span class="muted">yana ${a.days_left} kun</span></div>`).join("")}</div>` : ""}
    <div class="gr-mods">Hozirgi umumiy ta'sir: trafik <b>${g.mods.traffic}×</b> · sotuv <b>${pct(g.mods.demand)}</b> · qo'shimcha o'sish <b>${(g.mods.growth * 100).toFixed(1)}%/kun</b>
      ${sys === "red" || sys === "down" ? `<span class="neg"> · ⚠ tizim ${esc(state.metrics.status_title)} — reklama samarasiz!</span>` : ""}</div>

    <h2>📣 Marketing kampaniyalari <small class="muted">vaqtinchalik</small></h2>
    ${!live ? `<div class="tip warn">Sayt hali internetda emas — reklama qilib bo'lmaydi. Avval 🚀 qadamlarni bajaring.</div>` : ""}
    <div class="gr-grid">${Object.entries(cat.marketing).map(([id, m]) => {
      const on = g.campaigns.find((c) => c.id === id);
      const why = on ? `ketyapti · ${on.days_left} kun` : !live ? "sayt ishlamayapti" : coins < m.cost ? "pul yetmaydi" : "";
      return `<div class="gr-card ${on ? "on" : ""}"><div class="gr-ico">${m.icon}</div><b>${esc(m.title)}</b>
        <p>${esc(m.about)}</p><div class="small">${effectLine(m)} · ${m.days} kun</div>
        <button class="btn ${why ? "" : "primary"} small" data-buy="campaign:${id}" ${why ? "disabled" : ""}>${why || `Boshlash · ${usd(m.cost)}`}</button></div>`;
    }).join("")}</div>

    <h2>🧩 Yangi imkoniyatlar <small class="muted">bir marta sotib olinadi, doimiy</small></h2>
    <div class="gr-grid">${Object.entries(cat.upgrades).map(([id, u]) => {
      const own = g.upgrades.includes(id);
      const need = u.needs && !state.blocks.some((b) => b.kind === u.needs) ? `kerak: ${data.catalog.blocks[u.needs].title}` : "";
      const why = own ? "✓ bor" : need || (coins < u.cost ? "pul yetmaydi" : "");
      return `<div class="gr-card ${own ? "own" : ""}"><div class="gr-ico">${u.icon}</div><b>${esc(u.title)}</b>
        <p>${esc(u.about)}</p>${effectLine(u) ? `<div class="small">${effectLine(u)}</div>` : `<div class="small">himoya</div>`}
        <button class="btn ${why ? "" : "primary"} small" data-buy="upgrade:${id}" ${why ? "disabled" : ""}>${why || `Sotib olish · ${usd(u.cost)}`}</button></div>`;
    }).join("")}</div>

    <div class="gr-cols">
      <div>
        <h2>⚡ Hodisalar</h2>
        <p class="muted small">Sayt ishga tushgach, vaqti-vaqti bilan kutilmagan narsalar bo'ladi: mashhurlik, bayram, raqobatchi,
          disk buzilishi, elektr uzilishi. Zaxira nusxa va monitoring yomon hodisalardan himoya qiladi.</p>
        ${g.event_log.length ? g.event_log.slice().reverse().map((e) => `<div class="gr-ev ${e.good ? "good" : "bad"}"><span class="muted">Kun ${e.day}</span> ${esc(e.text)}</div>`).join("")
          : `<div class="muted">Hali hodisa bo'lmadi.</div>`}
      </div>
      <div>
        <h2>🏆 Yutuqlar <small class="muted">${doneAch}/${g.achievements.length}</small></h2>
        <div class="gr-ach">${g.achievements.map((a) => `<span class="${a.done ? "done" : ""}">${a.done ? "🏆" : "○"} ${esc(a.title)}</span>`).join("")}</div>
        <h2>🏢 Startuplar portfeli</h2>
        <table class="rp-table"><thead><tr><th>Startup</th><th>Biznes</th><th>Mijozlar</th><th>Kassa</th><th></th></tr></thead>
          <tbody>${g.portfolio.rooms.map((r) => `<tr class="${r.active ? "gr-cur" : ""}"><td><b>${esc(r.name)}</b></td>
            <td>${r.business ? esc(data.catalog.businesses[r.business].icon + " " + data.catalog.businesses[r.business].title) : "—"}</td>
            <td>${fmt(r.users)}</td><td class="pos">${usd(r.kassa)}</td>
            <td>${r.active ? "<span class='muted'>hozir</span>" : `<button class="link" data-open="${r.id}">ochish</button>`}</td></tr>`).join("")}</tbody></table>
        <div class="gr-total">Umumiy balans (hamma startuplar uchun bitta): <b>${usd(g.portfolio.total)}</b></div>
        <button class="btn primary" id="grNew">🚀 Yangi startup ochish</button>
      </div>
    </div>
  </section>`;
  const root = $("page-growth");
  root.querySelectorAll("[data-buy]").forEach((el) => el.onclick = () => {
    const [kind, id] = el.dataset.buy.split(":");
    actions.buyGrowth(kind, id);
  });
  root.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => actions.openRoom(Number(el.dataset.open)));
  $("grNew").onclick = actions.newRoom;
}
