// =========================================================================
// site.js — 🌐 "Sayt" sahifasi: o'yinchining sayti JONLI ko'rinishda.
//   Chapda — brauzer oynasi: mijoz nimani ko'radi (vitrina, narxlar, tugmalar).
//     Tizim holatiga qarab: domen yo'q → DNS xato; deploy yo'q → 502;
//     sekin → yuklanish; HTTP → "Xavfsiz emas"; to'lov yo'q → sotib olib bo'lmaydi.
//   O'ngda — admin: mahsulotlar, narx va tannarx, bugungi sotuv va foyda.
// =========================================================================
import { esc } from "./tpl.js";
import { usd } from "./report.js";
import { recentLogs } from "./logs.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");

// Brauzerdagi talab hisobi — backend (business.sales) bilan bir xil formula
export function previewRow(o, biz, users, err) {
  const f = Math.min(3, Math.exp(-biz.k * (o.price / o.ref - 1)));
  const per = biz.unit === "oy" ? 1 / 30 : 1;
  const qty = users * o.rate * f * (1 - err);
  return { qty, revenue: qty * o.price * per, profit: qty * (o.price - o.cost) * per, demand: f, best: o.cost + o.ref / biz.k };
}

function siteState(state) {
  const L = state.launch, m = state.metrics;
  if (!L.domain) return { kind: "dns" };
  if (!m.path_ok || m.status === "down") return { kind: "502" };
  return { kind: "ok", slow: m.p95_ms > 1000, warnSlow: m.p95_ms > 300 };
}

function browserBody(state, data, biz, offers) {
  const st = siteState(state), L = state.launch, m = state.metrics, f = state.finance;
  if (st.kind === "dns") {
    return `<div class="br-error"><div class="br-big">😕</div><h2>Bu saytga ulanib bo'lmadi</h2>
      <p class="muted">${esc(state.ctx.project)}.uz manzilining IP sini topib bo'lmadi.</p>
      <code>DNS_PROBE_FINISHED_NXDOMAIN</code>
      <p>Mijozlar saytni umuman topa olmaydi. <b>🚀 2-qadam: Domen</b> ni bajaring.</p></div>`;
  }
  if (st.kind === "502") {
    return `<div class="br-error"><h1 class="br-502">502 Bad Gateway</h1><hr><p class="muted">nginx/1.24.0 (Ubuntu)</p>
      <div class="tip bad" style="text-align:left"><b>Nega?</b><ul>${(m.path_problems.length ? m.path_problems : ["Tizim ishlamayapti (qizil bloklarni tekshiring)"])
        .map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      <p>Bu paytda <b>hech kim hech narsa sotib olmaydi</b> va mijozlar kamayadi.</p></div>`;
  }
  const sales = f.sales;
  const rowOf = (name) => (sales.rows || []).find((r) => r.name === name);
  const buyBlock = !m.payment_ok
    ? (!state.blocks.some((b) => b.kind === "payment") ? "To'lov tizimi ulanmagan" : !m.ssl ? "To'lov bloklandi: sayt HTTPS emas" : "To'lov ishlamayapti")
    : "";
  const cards = offers.map((o) => {
    const r = rowOf(o.name);
    return `<div class="sp-card">
      <div class="sp-emoji">${esc(o.emoji || "📦")}</div>
      <div class="sp-name">${esc(o.name)}</div>
      <div class="sp-price">${usd(o.price)}${biz.unit === "oy" ? "<small>/oy</small>" : ""}</div>
      <button class="sp-buy" ${buyBlock ? "disabled" : ""} title="${esc(buyBlock)}">${esc(biz.cta)}</button>
      <div class="sp-sold">${r ? (buyBlock ? `${r.qty} kishi xohladi, lekin to'lay olmadi` : `bugun ${r.paid} ${biz.unit === "oy" ? "obunachi" : "ta sotildi"}`) : ""}</div>
    </div>`;
  }).join("");
  const news = state.business.key === "news" ? `<div class="sp-news">${["Toshkentda yangi metro bekati ochildi", "Dollar kursi: bugungi o'zgarishlar",
    "IT-park rezidentlari soni 2 baravar oshdi", "Ob-havo: hafta oxiri iliq bo'ladi"].map((t, i) =>
    `<div class="sp-art"><div class="sp-thumb">${["🚇", "💱", "💻", "☀"][i]}</div><div><b>${t}</b><div class="muted small">${fmt(state.room.users * (0.3 - i * 0.05))} marta o'qildi · reklama ko'rsatildi</div></div></div>`).join("")}</div>` : "";
  return `
    ${st.slow ? `<div class="br-loading"><span class="spin"></span> Sahifa ${(m.p95_ms / 1000).toFixed(1)} s da ochildi — mijozlarning ko'pi kutmasdan chiqib ketadi</div>` : ""}
    ${L.pending_migration ? `<div class="br-django"><b>ProgrammingError at /smeta/</b><br>relation "smeta_smeta" does not exist<br><small>har 5 so'rovdan 1 tasi shu xatoni oladi — 🚀 Deploy ichida migrate qiling</small></div>` : ""}
    ${m.error_rate > 0.02 && !L.pending_migration ? `<div class="br-django" style="background:#fdecea">⚠ ${Math.round(m.error_rate * 100)}% mijoz "504 Gateway Timeout" ko'ryapti</div>` : ""}
    <div class="sp-nav"><b>${esc(biz.icon)} ${esc(state.room.name)}</b><span>Bosh sahifa</span><span>${esc(biz.site_name)}</span><span>Aloqa</span>
      ${state.metrics.bot_ok ? `<span class="sp-tg">✈ Telegram bot</span>` : ""}</div>
    <div class="sp-hero"><h2>${esc(biz.hero)}</h2><p class="muted">${fmt(state.room.users)} ta mijoz bizni tanlagan</p></div>
    ${buyBlock ? `<div class="sp-alert">🔒 ${esc(buyBlock)} — tugmalar ishlamaydi, pul kelmaydi.</div>` : ""}
    ${news}
    <div class="sp-grid">${cards}</div>
    <div class="sp-foot">© ${new Date().getFullYear()} ${esc(state.room.name)} · ${L.done.ssl ? "🔒 Xavfsiz to'lov" : "⚠ Ulanish shifrlanmagan"}</div>`;
}

function adminHtml(state, data, ui, biz, offers) {
  const users = state.room.users, err = state.metrics.error_rate;
  const dirty = !!ui.offerDraft;
  const rows = offers.map((o, i) => {
    const p = previewRow(o, biz, users, err);
    const margin = o.price - o.cost;
    return `<tr>
      <td><input class="of-emoji" data-i="${i}" data-f="emoji" value="${esc(o.emoji || "📦")}" maxlength="4"></td>
      <td><input data-i="${i}" data-f="name" value="${esc(o.name)}" maxlength="30"></td>
      <td><input type="number" step="0.5" min="0.5" data-i="${i}" data-f="price" value="${o.price}"></td>
      <td><input type="number" step="0.1" min="0" data-i="${i}" data-f="cost" value="${o.cost}"></td>
      <td class="${margin > 0 ? "pos" : "neg"}">${usd(margin)}</td>
      <td><div class="of-dem"><i style="width:${Math.min(100, p.demand * 33)}%"></i></div>${Math.round(p.demand * 100)}%</td>
      <td>${p.qty.toFixed(1)}</td>
      <td class="${p.profit >= 0 ? "pos" : "neg"}"><b>${usd(p.profit, true)}</b></td>
      <td>${ui.showBest ? `<span class="muted">≈${usd(p.best)}</span>` : ""}</td>
      <td><button class="btn small ghost" data-del="${i}" ${offers.length <= 1 ? "disabled" : ""}>✕</button></td></tr>`;
  }).join("");
  const tot = offers.reduce((s, o) => { const p = previewRow(o, biz, users, err); return { rev: s.rev + p.revenue, pr: s.pr + p.profit }; }, { rev: 0, pr: 0 });
  const f = state.finance;
  return `
    <h2>🛠 Admin · mahsulotlar va narxlar</h2>
    <p class="muted small">${esc(biz.pitch)}</p>
    <div class="tip info small"><b>Narx qanday ishlaydi:</b> narx oshsa — har sotuvdan foyda ko'p, lekin xaridor kamayadi (“talab” ustuni).
      Juda arzon bo'lsa — ko'p sotasiz, lekin deyarli foydasiz. O'rtadagi eng foydali nuqtani toping.
      ${biz.unit === "oy" ? "Tarif narxi — oylik; kunlik daromad = obunachilar × narx / 30." : ""}</div>
    <div class="of-wrap"><table class="of-table">
      <thead><tr><th></th><th>Nomi</th><th>Narx $</th><th>Tannarx $</th><th>1 donadan</th><th>Talab</th><th>Sotuv/kun</th><th>Foyda/kun</th><th></th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="row" style="justify-content:space-between;margin-top:8px">
      <div class="row"><button class="btn small" id="ofAdd" ${offers.length >= 6 ? "disabled" : ""}>＋ Mahsulot</button>
        <button class="link" id="ofBest">${ui.showBest ? "maslahatni yashirish" : "💡 eng foydali narx qancha?"}</button></div>
      <div class="row">${dirty ? `<button class="btn small ghost" id="ofUndo">Bekor</button>` : ""}
        <button class="btn primary small" id="ofSave" ${dirty ? "" : "disabled"}>Saqlash</button></div>
    </div>
    <div class="of-sum">Yangi narxlar bilan taxminan: sotuvdan <b>${usd(tot.rev)}</b>/kun, shundan foyda <b class="${tot.pr >= 0 ? "pos" : "neg"}">${usd(tot.pr, true)}</b>
      ${!state.metrics.payment_ok ? `<br><span class="neg">Lekin hozir to'lov ishlamaydi — haqiqiy daromad $0${biz.ads ? " (faqat reklama)" : ""}.</span>` : ""}</div>

    <h3>📈 Bugun (haqiqiy)</h3>
    <div class="kv"><span>Sotuvlar</span><b>${f.sales.orders} ta</b></div>
    <div class="kv"><span>Sotuvdan daromad</span><b class="pos">${usd(f.sales.revenue)}</b></div>
    ${f.sales.ads ? `<div class="kv"><span>Reklamadan</span><b class="pos">${usd(f.sales.ads)}</b></div>` : ""}
    ${f.sales.cogs ? `<div class="kv"><span>Mahsulot tannarxi</span><b class="neg">${usd(-f.sales.cogs)}</b></div>` : ""}
    <div class="kv"><span>Server, elektr va boshqalar</span><b class="neg">${usd(-(f.cost - f.sales.cogs))}</b></div>
    <div class="kv total"><span>Sof foyda</span><b class="${f.net >= 0 ? "pos" : "neg"}">${usd(f.net, true)}</b></div>
    <h3>🔔 Jonli buyurtmalar</h3><div class="sp-feed" id="spFeed"></div>`;
}

export function drawFeed() {
  const el = $("spFeed");
  if (!el) return;
  const rows = recentLogs("money", 8);
  el.innerHTML = rows.length ? rows.map((l) => `<div class="${l.cls}"><span class="muted">${l.t}</span> ${esc(l.text.replace(/^\w+\s+/, ""))}</div>`).join("")
    : `<div class="muted">Hali buyurtma yo'q.</div>`;
}

export function renderSite(state, data, ui, actions) {
  const key = state.business.key;
  const biz = data.catalog.businesses[key];
  const offers = ui.offerDraft || state.business.offers;
  const L = state.launch, m = state.metrics;
  const url = L.domain ? `${L.done.ssl ? "https" : "http"}://${L.domain}/` : `${state.ctx.project}.uz`;
  $("page-site").innerHTML = `
    <section class="card site-left">
      <div class="eyebrow">${esc(biz.icon)} ${esc(biz.title)} · mijoz ko'radigan sayt</div>
      <div class="browser">
        <div class="br-bar"><span class="br-dots"><i></i><i></i><i></i></span>
          <span class="br-url ${L.done.ssl ? "secure" : "insecure"}">${L.done.ssl ? "🔒" : L.domain ? "⚠ Xavfsiz emas ·" : "○"} ${esc(url)}</span>
          <span class="br-time ${m.p95_ms > 1000 ? "neg" : m.p95_ms > 300 ? "warnc" : "pos"}">⏱ ${m.path_ok ? m.p95_ms + " ms" : "—"}</span></div>
        <div class="br-body">${browserBody(state, data, biz, state.business.offers)}</div>
      </div>
      <p class="muted small">Bu sahifa doskadagi tizimingizdan jonli yasaladi: server sekinlashsa — sayt ham sekinlashadi, baza yiqilsa — mijoz 502 ko'radi.</p>
    </section>
    <aside class="card site-admin">${adminHtml(state, data, ui, biz, offers)}</aside>`;
  drawFeed();

  const root = $("page-site");
  const draft = () => (ui.offerDraft ||= state.business.offers.map((o) => ({ ...o })));
  root.querySelectorAll(".of-table input").forEach((el) => el.onchange = () => {
    const d = draft(), o = d[Number(el.dataset.i)], fld = el.dataset.f;
    o[fld] = fld === "price" || fld === "cost" ? Math.max(0, Number(el.value) || 0) : el.value;
    renderSite(state, data, ui, actions);
  });
  root.querySelectorAll("[data-del]").forEach((el) => el.onclick = () => { draft().splice(Number(el.dataset.del), 1); renderSite(state, data, ui, actions); });
  $("ofAdd").onclick = () => {
    const d = draft(), last = d[d.length - 1];
    d.push({ name: "Yangi mahsulot", price: last.price, cost: last.cost, emoji: "📦", ref: last.price, rate: +(last.rate * 0.8).toFixed(4) });
    renderSite(state, data, ui, actions);
  };
  $("ofBest").onclick = () => { ui.showBest = !ui.showBest; renderSite(state, data, ui, actions); };
  if ($("ofUndo")) $("ofUndo").onclick = () => { ui.offerDraft = null; renderSite(state, data, ui, actions); };
  $("ofSave").onclick = () => actions.saveOffers(ui.offerDraft);
}
