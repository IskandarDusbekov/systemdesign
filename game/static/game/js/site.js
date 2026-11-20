// =========================================================================
// site.js — 🌐 "Sayt" sahifasi: o'yinchining sayti JONLI ko'rinishda.
//   Chapda — brauzer oynasi: mijoz nimani ko'radi (vitrina, narxlar, tugmalar).
//     Tizim holatiga qarab: domen yo'q → DNS xato; deploy yo'q → 502;
//     sekin → yuklanish; HTTP → "Xavfsiz emas"; to'lov yo'q → sotib olib bo'lmaydi.
//   O'ngda — admin: mahsulotlar, narx va tannarx, bugungi sotuv va foyda.
// =========================================================================
import { esc } from "./tpl.js";
import { ico } from "./ui-icons.js";
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

export function siteState(state) {
  const L = state.launch, m = state.metrics;
  if (!L.domain) return { kind: "dns" };
  if (!L.dns) return { kind: "nodns" };                        // domen bor, A yozuvi yo'q
  if (!state.blocks.some((b) => ["nginx", "lb"].includes(b.kind) && b.host === L.dns)) return { kind: "refused" };
  if (!L.done.deploy) return { kind: "notyet" };
  if (!m.path_ok || m.status === "down") return { kind: "502" };
  return { kind: "ok", slow: m.p95_ms > 1000, warnSlow: m.p95_ms > 300 };
}

// So'rov yo'li: mijoz manzilni yozgandan javob kelguncha nima bo'ladi (real hayotdagidek)
function flowSteps(state) {
  const L = state.launch, m = state.metrics, has = (k) => state.blocks.some((b) => b.kind === k);
  const st = siteState(state);
  const steps = [
    { t: "Brauzer", s: "mijoz manzilni yozdi", ok: true },
    { t: "DNS", s: L.domain ? (L.dns_ip ? `${L.domain} → ${L.dns_ip}` : "A yozuvi yo'q") : "domen yo'q", ok: !!L.domain && !!L.dns_ip },
    { t: "Server", s: L.dns_ip ? `IP ${L.dns_ip}` : "IP yo'q", ok: !!L.dns_ip && has("server") },
    { t: "Nginx", s: has("nginx") || has("lb") ? (L.done.ssl ? "HTTPS :443" : "HTTP :80") : "yo'q", ok: has("nginx") || has("lb") },
    { t: "Django", s: L.done.deploy ? "views.py ishladi" : "kod yuklanmagan", ok: L.done.deploy && has("app") },
    { t: "Baza", s: has("postgres") ? "SQL so'rov" : "yo'q", ok: has("postgres") && st.kind !== "502" },
    { t: "Javob", s: st.kind === "ok" ? `200 OK · ${m.p95_ms} ms` : st.kind === "502" ? "502 xato" : "kelmadi", ok: st.kind === "ok" },
  ];
  let broken = false;
  return steps.map((x) => { const r = { ...x, cls: broken ? "skip" : x.ok ? "ok" : "bad" }; if (!x.ok) broken = true; return r; });
}

function flowHtml(state) {
  return `<div class="rq-flow" title="Mijoz saytni ochganda so'rov shu yo'ldan o'tadi">
    ${flowSteps(state).map((x, i) => `${i ? `<span class="rq-arr">${ico("arrowRight", 12)}</span>` : ""}<span class="rq ${x.cls}">
      <b>${x.cls === "ok" ? ico("check", 11) : x.cls === "bad" ? ico("x", 11) : ""} ${esc(x.t)}</b><small>${esc(x.s)}</small></span>`).join("")}</div>`;
}

// "Vallum izohi" — haqiqiy sahifa ostida, nima bo'layotganini tushuntiradi
const why = (html) => `<div class="br-why">${ico("info", 14)}<div>${html}</div></div>`;

export function browserBody(state, data, biz, offers) {
  const st = siteState(state), L = state.launch, m = state.metrics, f = state.finance;
  if (st.kind === "nodns") {
    return `<div class="cr-err"><div class="cr-ico">${ico("alert", 40)}</div><h2>This site can't be reached</h2>
      <p><b>${esc(L.domain)}</b>'s server IP address could not be found.</p>
      <code>DNS_PROBE_FINISHED_NXDOMAIN</code><div class="cr-btn">Reload</div></div>
      ${why(`<b>Nima bo'ldi:</b> domen sizniki, lekin DNS da <b>A yozuvi</b> yo'q — brauzer "${esc(L.domain)} qaysi IP da?" deb so'radi va javob ololmadi.
        <b>Brauzer → domenchi.uz → Mening domenlarim → DNS</b> da A yozuviga server IP sini yozing.`)}`;
  }
  if (st.kind === "refused") {
    return `<div class="cr-err"><div class="cr-ico">${ico("alert", 40)}</div><h2>This site can't be reached</h2>
      <p><b>${esc(L.domain)}</b> refused to connect.</p><code>ERR_CONNECTION_REFUSED</code><div class="cr-btn">Reload</div></div>
      ${why(`<b>Nima bo'ldi:</b> DNS ishladi — so'rov ${esc(L.dns_ip || "")} serverga yetib keldi. Lekin serverda 80/443-portni
        tinglaydigan dastur (<b>Nginx</b>) yo'q, shuning uchun server ulanishni rad etdi. Doskada shu serverga Nginx qo'ying.`)}`;
  }
  if (st.kind === "dns") {
    return `<div class="cr-err"><div class="cr-ico">${ico("alert", 40)}</div><h2>This site can't be reached</h2>
      <p>Check if there is a typo in <b>${esc(state.ctx.project)}.uz</b>.</p>
      <ul><li>If spelling is correct, try running Windows Network Diagnostics.</li></ul>
      <code>DNS_PROBE_FINISHED_NXDOMAIN</code><div class="cr-btn">Reload</div></div>
      ${why(`<b>Nima bo'ldi:</b> brauzer DNS dan "${esc(state.ctx.project)}.uz qaysi IP da?" deb so'radi — javob: bunday domen yo'q.
        Mijozlar saytni umuman topa olmaydi. <b>🚀 Domen</b> qadamida domen sotib olib, server IP siga yo'naltiring.`)}`;
  }
  if (st.kind === "notyet") {
    return `<div class="ng-page"><h1>Welcome to nginx!</h1>
      <p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
      <p><em>Thank you for using nginx.</em></p></div>
      ${why(`<b>Nima bo'ldi:</b> domen serveringizga yetib keldi va Nginx javob berdi — lekin serverda hali sizning kodingiz yo'q,
        shuning uchun Nginx o'zining standart sahifasini ko'rsatyapti. <b>🚀 Deploy</b> qiling — Django sayti ochiladi va birinchi 50 foydalanuvchi keladi.`)}`;
  }
  if (st.kind === "502") {
    return `<div class="ng-page center"><h1>502 Bad Gateway</h1><hr><p>nginx/1.24.0 (Ubuntu)</p></div>
      ${why(`<b>Nima bo'ldi:</b> Nginx so'rovni orqadagi dasturga (Django/gunicorn) uzatdi, lekin javob ololmadi.
        <ul>${(m.path_problems.length ? m.path_problems : ["Tizim ishlamayapti (doskadagi qizil bloklarni tekshiring)"]).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        Bu paytda <b>hech kim hech narsa sotib olmaydi</b> va mijozlar kamayadi.`)}`;
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
    ${L.pending_migration ? `<div class="br-django"><b>ProgrammingError at /products/</b><br>relation "app_order" does not exist<br><small>har 5 so'rovdan 1 tasi shu xatoni oladi — 🚀 Deploy ichida migrate qiling</small></div>` : ""}
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
    <div class="kv"><span>Server ijarasi va xizmatlar</span><b class="neg">${usd(-(f.cost - f.sales.cogs))}</b></div>
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

// ---------------- Django admin (/admin/) ----------------
const root0 = () => $("page-site");
const SAMPLE = {
  name: ["Krossovka Air", "Futbolka oq", "Kurtka qishki", "Shim jins", "Kepka"], title: ["Yangi kolleksiya", "Chegirma 20%", "Yozgi to'plam", "Bestseller", "Sovg'a to'plami"],
  phone: ["+998 90 111 22 33", "+998 93 555 10 20", "+998 97 700 00 07", "+998 99 123 45 67", "+998 91 888 77 66"],
  email: ["ali@mail.uz", "nodira@gmail.com", "sardor@inbox.uz", "malika@mail.ru", "jasur@gmail.com"],
  status: ["yangi", "to'landi", "yo'lda", "yetkazildi", "bekor"], address: ["Chilonzor 9", "Yunusobod 4", "Sergeli 2", "Mirzo Ulug'bek", "Olmazor 12"],
};
function fakeVal(f, i) {
  const n = f.name;
  if (f.type === "BooleanField") return i % 3 ? "✅" : "❌";
  if (f.type === "DateTimeField") return `2026-11-${String(20 - i).padStart(2, "0")} ${10 + i}:${i}5`;
  if (f.type === "ForeignKey") return `${f.to} #${3 + i * 2}`;
  if (f.type === "IntegerField") return String((i + 1) * (n.includes("qty") || n.includes("soni") ? 1 : 7));
  if (f.type === "DecimalField") return `${(19.9 + i * 12.5).toFixed(2)}`;
  const key = Object.keys(SAMPLE).find((k) => n.includes(k));
  if (key) return SAMPLE[key][i % 5];
  return f.type === "TextField" ? "Matn…" : `${n} ${i + 1}`;
}
const plural = (n) => `${n}s`;

// Django admin: avval createsuperuser (terminal), keyin /admin/login/, keyin panelning o'zi
function djGateHtml(state) {
  const dj = state.djadmin, host = state.launch.domain || `${state.ctx.project}.uz`;
  if (!dj.super) {
    return `<div class="dj-gate">
      <div class="tip info small">Admin panelga kirish uchun avval <b>admin foydalanuvchi</b> kerak. Real loyihada u serverda
        bir marta terminal orqali yaratiladi. Parol bazada ochiq emas — <b>xesh</b> ko'rinishida saqlanadi.</div>
      <form class="dj-su" id="djSu" autocomplete="off">
        <div class="dj-su-cmd">$ python manage.py createsuperuser</div>
        <label>Username: <input name="username" value="admin" required></label>
        <label>Email address: <input name="email" type="email" placeholder="(ixtiyoriy)"></label>
        <label>Password: <input name="password" type="password" autocomplete="new-password" required></label>
        <label>Password (again): <input name="password2" type="password" autocomplete="new-password" required></label>
        <button class="btn primary small" type="submit">Enter ↵</button>
      </form>
      <p class="muted small">Parol qoidalari xuddi Django'dagidek: kamida 8 belgi, juda oddiy emas, faqat raqam emas.</p></div>`;
  }
  return `<div class="dj-login">
      <div class="dj-url mono">${ico("lock", 11)} ${esc(host)}/admin/login/?next=/admin/</div>
      <div class="dj-lbox">
        <div class="dj-lhead">${esc(dj.header)}</div>
        <form id="djLogin" autocomplete="off">
          <label>Username:<input name="username" value="${esc(dj.super)}" required></label>
          <label>Password:<input name="password" type="password" autocomplete="current-password" required autofocus></label>
          <button class="dj-lbtn" type="submit">Log in</button>
        </form>
      </div>
      <p class="muted small">Bu — saytingizning <b>/admin/</b> sahifasi. Faqat xodimlar (is_staff) kira oladi; mijozlar uni ko'rmaydi.</p></div>`;
}

const djHeadHtml = (state) => `<div class="dj-head">${esc(state.djadmin.header)}<span>XUSH KELIBSIZ,
  <b>${esc(state.djadmin.super.toUpperCase())}</b>. SAYTNI KO'RISH / <button class="dj-out" id="djOut">CHIQISH</button></span></div>`;
const djNameHtml = (state) => `<h3>⚙ Panel nomi → <span class="mono">admin.site.site_header</span></h3>
    <div class="dj-name"><input id="djHeader" maxlength="60" value="${esc(state.djadmin.header)}" placeholder="Masalan: SmetaPro boshqaruvi">
      <button class="btn small" id="djHeaderSave">Saqlash</button></div>
    <p class="muted small">Yuqoridagi "${esc(state.djadmin.header)}" yozuvi — <span class="mono">app/admin.py</span> dagi
      <span class="mono">admin.site.site_header</span>. O'zgartirsangiz, kod ham o'zgaradi va kommit yoziladi.</p>`;

function djangoAdminHtml(state, ui) {
  if (!state.djadmin?.logged) return djGateHtml(state);
  const models = state.schema?.models || state.models || [];
  const cfg = ui.djDraft || state.admin || {};
  if (!models.length) {
    return `<div class="dj">${djHeadHtml(state)}
      <div class="tip info">Admin panelda ko'rsatadigan jadval yo'q. Avval <b>Kod → app/models.py</b> da model yarating
      (Model quruvchi → "Shablonni qo'yish").</div>
      <button class="link" data-openfile="app/models.py">🗄 Model quruvchini ochish →</button>${djNameHtml(state)}</div>`;
  }
  const cur = models.find((m) => m.name === ui.djModel && cfg[m.name]?.on !== false) || null;
  const list = models.map((m) => {
    const off = cfg[m.name]?.on === false;
    return `<tr class="${off ? "dj-off" : ""}"><th><button class="dj-a" data-djm="${esc(m.name)}" ${off ? "disabled" : ""}>${esc(plural(m.name))}</button>
      ${off ? `<small class="muted"> — yashirilgan</small>` : ""}</th><td><span class="dj-add">＋ Qo'shish</span></td><td><span class="dj-chg">✎ O'zgartirish</span></td></tr>`;
  }).join("");
  let change = "";
  if (cur) {
    const c = cfg[cur.name] || { list: [], search: [], filter: [] };
    const cols = c.list.length ? c.list : [];
    const flds = cur.fields;
    const rows = [0, 1, 2, 3, 4].map((i) => `<tr><td><input type="checkbox"></td><td class="dj-link">${cols.length ? 5 - i : `${cur.name} object (${5 - i})`}</td>
      ${cols.map((n) => `<td>${esc(fakeVal(flds.find((f) => f.name === n), i))}</td>`).join("")}</tr>`).join("");
    change = `
      <div class="dj-crumb">Bosh sahifa › App › ${esc(plural(cur.name))}</div>
      <div class="dj-title"><b>O'zgartirish uchun ${esc(cur.name)} tanlang</b><span class="dj-add btnish">＋ ${esc(cur.name)} qo'shish</span></div>
      ${c.search.length ? `<div class="dj-search">🔍 <input placeholder="${c.search.map(esc).join(", ")} bo'yicha qidirish"> <button class="btn small">Qidirish</button></div>` : ""}
      <div class="dj-body"><div class="of-wrap"><table class="dj-table"><thead><tr><th></th><th>${cols.length ? "ID" : esc(cur.name.toUpperCase())}</th>
        ${cols.map((n) => `<th>${esc(n.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
        ${c.filter.length ? `<div class="dj-filter"><b>Filtr</b>${c.filter.map((n) => `<div><i>${esc(n)} bo'yicha</i><span>Hammasi</span></div>`).join("")}</div>` : ""}</div>
      <div class="muted small">5 ta ${esc(cur.name)} (namuna ma'lumot)</div>`;
  }
  const edit = models.map((m) => {
    const c = cfg[m.name] || { on: true, list: [], search: [], filter: [] };
    const box = (key, f, ok) => ok ? `<input type="checkbox" data-dj="${esc(m.name)}" data-k="${key}" data-f="${esc(f.name)}" ${c[key].includes(f.name) ? "checked" : ""}>` : `<span class="muted">—</span>`;
    return `<details class="dj-cfg" ${m.name === ui.djModel ? "open" : ""}><summary><label><input type="checkbox" data-djon="${esc(m.name)}" ${c.on !== false ? "checked" : ""}>
        <b>${esc(m.name)}</b></label> <span class="muted small">adminda ko'rsatish</span></summary>
      <table class="dj-cfg-t"><thead><tr><th>Maydon</th><th title="list_display — ro'yxatda ustun">ustun</th><th title="search_fields — qidiruv">qidiruv</th><th title="list_filter — o'ngdagi filtr">filtr</th></tr></thead>
      <tbody>${m.fields.map((f) => `<tr><td class="mono">${esc(f.name)}</td><td>${box("list", f, true)}</td>
        <td>${box("search", f, ["CharField", "TextField"].includes(f.type))}</td>
        <td>${box("filter", f, ["BooleanField", "DateTimeField", "ForeignKey", "CharField"].includes(f.type))}</td></tr>`).join("")}</tbody></table></details>`;
  }).join("");
  return `<div class="dj">
    ${djHeadHtml(state)}
    ${cur ? change : `<div class="dj-crumb">Bosh sahifa</div>
      <table class="dj-apps"><caption>APP</caption>${list}</table>
      <table class="dj-apps"><caption>AUTHENTICATION AND AUTHORIZATION</caption>
        <tr><th><span class="dj-a">Groups</span></th><td><span class="dj-add">＋ Qo'shish</span></td><td></td></tr>
        <tr><th><span class="dj-a">Users</span></th><td><span class="dj-add">＋ Qo'shish</span></td><td></td></tr></table>`}
    ${cur ? `<button class="link" data-djm="">← Bosh sahifa</button>` : ""}
    ${djNameHtml(state)}
    <h3>⚙ Sozlash → <span class="mono">app/admin.py</span></h3>
    <p class="muted small">Har jadval uchun: ro'yxatda qaysi <b>ustun</b>lar ko'rinsin (list_display), nima bo'yicha <b>qidirilsin</b> (search_fields),
      o'ngda qanday <b>filtr</b> bo'lsin (list_filter). Saqlasangiz — kod o'zgaradi va kommit yoziladi.</p>
    ${edit}
    <div class="row" style="justify-content:space-between;margin-top:8px">
      <button class="link" data-openfile="app/admin.py">{ } app/admin.py ni ko'rish</button>
      <span class="row">${ui.djDraft ? `<button class="btn small ghost" id="djUndo">Bekor</button>` : ""}
      <button class="btn primary small" id="djSave" ${ui.djDraft ? "" : "disabled"}>Saqlash · admin.py</button></span></div>
    <div class="tip info small">Admin panelga kirish uchun serverda bir marta: <code>python manage.py createsuperuser</code> —
      keyin <b>${esc(state.launch.domain || "sayt.uz")}/admin/</b> manzili orqali kirasiz. Bu sahifani faqat xodimlar ko'radi.</div>
  </div>`;
}

function bindDjango(state, data, ui, actions) {
  const root = root0(), rerender = () => renderSite(state, data, ui, actions);
  const form = (id, action) => {
    const f = $(id);
    if (f) f.onsubmit = (e) => { e.preventDefault(); actions.djadmin(action, Object.fromEntries(new FormData(f))); };
  };
  form("djSu", "superuser");
  form("djLogin", "login");
  if (!state.djadmin?.logged) return;
  if ($("djOut")) $("djOut").onclick = () => actions.djadmin("logout");
  if ($("djHeaderSave")) $("djHeaderSave").onclick = () => actions.djadmin("header", { header: $("djHeader").value });
  const draft = () => (ui.djDraft ||= JSON.parse(JSON.stringify(state.admin || {})));
  root.querySelectorAll("[data-djm]").forEach((b) => b.onclick = () => { ui.djModel = b.dataset.djm || null; rerender(); });
  root.querySelectorAll("[data-djon]").forEach((b) => b.onchange = () => {
    const d = draft(); d[b.dataset.djon] = { list: [], search: [], filter: [], ...(d[b.dataset.djon] || {}), on: b.checked }; rerender();
  });
  root.querySelectorAll("[data-dj]").forEach((b) => b.onchange = () => {
    const d = draft(), m = (d[b.dataset.dj] ||= { on: true, list: [], search: [], filter: [] }), arr = m[b.dataset.k];
    const i = arr.indexOf(b.dataset.f);
    if (b.checked && i < 0) arr.push(b.dataset.f);
    if (!b.checked && i >= 0) arr.splice(i, 1);
    ui.djModel = b.dataset.dj;
    rerender();
  });
  root.querySelectorAll("[data-openfile]").forEach((b) => b.onclick = () => actions.openFile(b.dataset.openfile));
  if ($("djUndo")) $("djUndo").onclick = () => { ui.djDraft = null; rerender(); };
  if ($("djSave")) $("djSave").onclick = () => actions.saveAdmin(ui.djDraft);
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
      ${flowHtml(state)}
      <div class="browser">
        <div class="br-tabs"><span class="br-dots"><i></i><i></i><i></i></span>
          <span class="br-tab">${ico(siteState(state).kind === "ok" ? "store" : "alert", 12)} ${esc(siteState(state).kind === "ok" ? state.room.name
            : ["dns", "nodns", "refused"].includes(siteState(state).kind) ? (state.launch.domain || `${state.ctx.project}.uz`) : siteState(state).kind === "notyet" ? "Welcome to nginx!" : "502 Bad Gateway")}<i>×</i></span>
          <span class="br-plus">+</span></div>
        <div class="br-bar"><span class="br-nav">${ico("arrowLeft", 14)}${ico("arrowRight", 14)}${ico("reset", 13)}</span>
          <span class="br-url ${L.done.ssl ? "secure" : "insecure"}">${L.done.ssl ? ico("lock", 12) : L.domain ? `<span class="br-ns">${ico("alert", 12)} Not secure</span>` : ico("search", 12)}
            ${esc(L.done.ssl ? url.replace("https://", "") : url)}</span>
          <span class="br-time ${m.p95_ms > 1000 ? "neg" : m.p95_ms > 300 ? "warnc" : "pos"}" title="Sahifa ochilish vaqti (p95)">${ico("clock", 12)} ${m.path_ok ? m.p95_ms + " ms" : "—"}</span></div>
        <div class="br-body">${browserBody(state, data, biz, state.business.offers)}</div>
      </div>
      <p class="muted small">Bu sahifa doskadagi tizimingizdan jonli yasaladi: server sekinlashsa — sayt ham sekinlashadi, baza yiqilsa — mijoz 502 ko'radi.
        Yuqoridagi zanjir — mijoz manzilni yozgandan javob kelguncha so'rov o'tadigan yo'l.</p>
    </section>
    <aside class="card site-admin">
      <div class="seg"><button class="${ui.siteAdmin !== "django" ? "on" : ""}" data-sa="shop">🛒 Do'kon: narxlar</button>
        <button class="${ui.siteAdmin === "django" ? "on" : ""}" data-sa="django">⚙ Django admin <small>/admin/</small></button></div>
      ${ui.siteAdmin === "django" ? djangoAdminHtml(state, ui) : adminHtml(state, data, ui, biz, offers)}</aside>`;
  root0().querySelectorAll("[data-sa]").forEach((b) => b.onclick = () => { ui.siteAdmin = b.dataset.sa; renderSite(state, data, ui, actions); });
  if (ui.siteAdmin === "django") { bindDjango(state, data, ui, actions); return; }
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
