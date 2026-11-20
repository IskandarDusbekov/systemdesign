// =========================================================================
// report.js — 📊 Hisobot sahifasi: startupning pul hisobi.
//   * balans, bugungi / 7 kunlik / 30 kunlik sof foyda;
//   * 1 mijoz qancha olib keladi va qancha turadi, zararsizlik nuqtasi;
//   * kunlik daromad va xarajat grafigi, xarajatlar tarkibi;
//   * kunma-kun jadval va "foydani qanday oshirish" maslahatlari.
// =========================================================================
import { esc } from "./tpl.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");

export function usd(x, sign = false) {
  const a = Math.abs(x);
  const body = a < 100 && a % 1 ? a.toFixed(1) : fmt(a);
  return `${x < 0 ? "−" : sign && x > 0 ? "+" : ""}$${body}`;
}

const sum = (arr, f) => arr.reduce((s, d) => s + f(d), 0);

function card(label, value, cls = "", sub = "") {
  return `<div class="rp-card ${cls}"><div class="rp-l">${label}</div><div class="rp-v">${value}</div>${sub ? `<div class="rp-s">${sub}</div>` : ""}</div>`;
}

function chart(h) {
  if (!h.length) return `<div class="muted rp-empty">Hali kun o'tmagan. ▶ yoki "+1 kun" bosing — grafik shu yerda chiziladi.</div>`;
  const W = 1000, H = 220, P = 30;
  const max = Math.max(...h.map((d) => Math.max(d.revenue, d.cost)), 10);
  const n = h.length, step = (W - 2 * P) / n, bw = Math.max(2, step / 2 - 1.5);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const bars = h.map((d, i) => {
    const x = P + i * step + 1;
    return `<rect x="${x}" y="${y(d.revenue)}" width="${bw}" height="${H - P - y(d.revenue)}" fill="#7cbf6a"><title>Kun ${d.day}: daromad ${usd(d.revenue)}</title></rect>
      <rect x="${x + bw + 1}" y="${y(d.cost)}" width="${bw}" height="${H - P - y(d.cost)}" fill="#e08a72"><title>Kun ${d.day}: xarajat ${usd(d.cost)}</title></rect>`;
  }).join("");
  const minC = Math.min(...h.map((d) => d.coins), 0), maxC = Math.max(...h.map((d) => d.coins), 1);
  const yc = (v) => H - P - ((v - minC) / (maxC - minC || 1)) * (H - 2 * P);
  const line = h.map((d, i) => `${i ? "L" : "M"}${P + i * step + step / 2},${yc(d.coins)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" class="rp-chart" preserveAspectRatio="none">
    <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" stroke="#c6bbac"/>
    ${bars}
    <path d="${line}" fill="none" stroke="#1d1b18" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>
  <div class="rp-legend"><span><i style="background:#7cbf6a"></i>daromad</span><span><i style="background:#e08a72"></i>xarajat</span>
    <span><i style="background:#1d1b18;height:2px"></i>balans (${usd(minC)} … ${usd(maxC)})</span></div>`;
}

function tips(state) {
  const f = state.finance, users = state.room.users, out = [];
  const empty = state.blocks.filter((b) => b.kind === "server" && !state.blocks.some((x) => x.host === b.id));
  if (!f.revenue) out.push(`<b>Daromad 0.</b> ${esc(f.revenue_why)}. Pul faqat To'lov shlyuzi Saytga ulangan va HTTPS yoqilgan bo'lsa keladi.`);
  if (empty.length) out.push(`<b>Bo'sh server(lar):</b> ${empty.map((b) => esc(b.name)).join(", ")} — hech narsa qilmaydi, lekin ijara to'lanyapti. O'chiring yoki ishga soling.`);
  if (f.revenue && f.net < 0) out.push(`<b>Xarajat daromaddan katta.</b> Server turini kichraytiring yoki mijoz ko'payguncha qo'shimcha xizmatlarni (CDN, replica) kechiktiring.`);
  if (state.metrics.status === "red" || state.metrics.status === "down") out.push(`<b>Tizim qiynalyapti</b> — xatolar daromadni kesadi va mijozlar o'smaydi. Doskadagi qizil blokni kuchaytiring.`);
  if (f.net > 0) out.push(`<b>Foyda bor ✓.</b> Mijozlar tizim yashil bo'lganda tez o'sadi. Foydaning bir qismini zaxira sifatida saqlang: kelajakdagi yuklamaga server kerak bo'ladi.`);
  if (users > 0 && f.revenue && f.cost / users > f.per_user * 0.8) out.push(`<b>1 mijozga xarajat juda yuqori</b> (${usd(f.cost / users)}): mijoz ko'paygani sari bu kamayadi — o'sishga e'tibor bering.`);
  return out.map((t) => `<div class="tip info">${t}</div>`).join("");
}

export function renderReport(state, actions) {
  const r = state.room, f = state.finance, h = state.history;
  const last = (n) => h.slice(-n);
  const net = (arr) => sum(arr, (d) => d.revenue - d.cost);
  const breakEven = f.per_user ? Math.ceil(f.fixed / f.per_user) : 0;
  const perUserCost = r.users ? f.cost / r.users : 0;
  const totalCost = f.cost || 1;
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");

  $("page-report").innerHTML = `
  <section class="card rp">
    <div class="rp-head">
      <div><h1>📊 Moliyaviy hisobot</h1>
        <p class="muted">Startup egasi har kuni shuni ko'radi: pul qayerdan keladi, qayerga ketadi, foyda bormi.</p></div>
      <button class="link" data-rguide="money">📖 Pul qanday ishlaydi</button>
    </div>
    <div class="rp-cards">
      ${card("Balans (hisobda)", usd(r.coins), r.coins < 0 ? "neg" : "", f.runway !== null ? `⚠ ${f.runway} kunga yetadi` : "")}
      ${card("Bugun sof foyda", usd(f.net, true), cls(f.net), `${usd(f.revenue)} − ${usd(f.cost)}`)}
      ${card("Oxirgi 7 kun", usd(net(last(7)), true), cls(net(last(7))), `${last(7).length} kun`)}
      ${card("Oxirgi 30 kun", usd(net(last(30)), true), cls(net(last(30))), `${last(30).length} kun`)}
      ${card("Jami daromad", usd(sum(h, (d) => d.revenue)), "", `${h.length} kun ichida`)}
      ${card("Jami xarajat", usd(sum(h, (d) => d.cost)), "", `${h.length} kun ichida`)}
    </div>

    <div class="rp-grid">
      <div>
        <h3>Daromad va xarajat — kunlar bo'yicha</h3>
        ${chart(last(30))}
      </div>
      <div>
        <h3>1 mijoz hisobi</h3>
        <div class="kv"><span>1 mijozdan sof daromad (tannarxsiz)</span><b>${f.revenue ? usd(f.per_user) : "$0 (to'lov yo'q)"}</b></div>
        <div class="kv"><span>1 mijozga xarajat (kuniga)</span><b>${usd(perUserCost)}</b></div>
        <div class="kv"><span>Mijozlar hozir</span><b>${fmt(r.users)}</b></div>
        <div class="kv"><span>Zararsizlik nuqtasi</span><b>${fmt(breakEven)} mijoz</b></div>
        <div class="tip ${r.users >= breakEven && f.revenue ? "" : "warn"}">
          ${!f.revenue ? "To'lov ishlamaguncha mijoz soni pul keltirmaydi."
            : r.users >= breakEven ? `✓ Zararsizlik nuqtasidan o'tdingiz: har yangi mijoz sof foyda.`
            : `Xarajatni qoplash uchun yana <b>${fmt(breakEven - r.users)}</b> mijoz kerak.`}</div>
        <h3>Bugungi xarajatlar tarkibi</h3>
        ${f.items.map((i) => `<div class="rp-bar"><span>${esc(i.label)}</span><b>${usd(i.amount)}</b>
          <i style="width:${Math.max(2, (i.amount / totalCost) * 100)}%"></i></div>`).join("")}
      </div>
    </div>

    <h3>Foydani oshirish uchun</h3>
    ${tips(state)}

    <h3>Kunlik jadval</h3>
    <div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>Kun</th><th>Mijozlar</th><th>Sotuv</th><th>Daromad</th><th>Xarajat</th><th>Sof</th><th>Balans</th><th>Tizim</th></tr></thead>
      <tbody>${last(30).reverse().map((d) => `<tr>
        <td>${d.day}</td><td>${fmt(d.users)}</td><td>${d.orders ?? "—"}</td><td class="pos">${usd(d.revenue)}</td><td class="neg">${usd(d.cost)}</td>
        <td class="${cls(d.revenue - d.cost)}">${usd(d.revenue - d.cost, true)}</td><td>${usd(d.coins)}</td>
        <td><i class="dot ${({ green: "g", yellow: "y", red: "r", down: "off" })[d.status] || ""}"></i> ${d.p95_ms} ms</td></tr>`).join("")
        || `<tr><td colspan="8" class="muted">Hali ma'lumot yo'q</td></tr>`}</tbody>
    </table></div>
  </section>`;
  $("page-report").querySelectorAll("[data-rguide]").forEach((el) => el.onclick = () => actions.guide(el.dataset.rguide));
}
