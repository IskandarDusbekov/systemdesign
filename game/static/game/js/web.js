// =========================================================================
// web.js — 🌐 BRAUZER: o'yin ichidagi internet (hammasi simulyatsiya).
// Real hayotdagidek: dasturchi brauzerda hosting saytiga kiradi, server ijaraga oladi,
// IP ni nusxalaydi, domen do'konida domen sotib oladi va DNS da A yozuvini shu IP ga ulaydi.
//   qidirbek.uz    — yangi tab / qidiruv ("Qidirbek — hammasini topadi, hatto yo'qolgan paypoqni ham")
// Bir nechta tab: "+" yangi tab, × yopish, Ctrl+bosish — havolani yangi tabda ochish.
//   bulutxon.uz    — hosting: VPS ijarasi (doskada Server bloki paydo bo'ladi), "Serverlarim" — IP
//   domenchi.uz    — domen do'koni: qidiruv, sotib olish, "Mening domenlarim" → DNS (A yozuvi)
//   github.com/... — Git bo'limiga yo'l
//   sizning domeningiz — mijoz ko'radigan sayt (site.js bilan bir xil)
// =========================================================================
import { esc } from "./tpl.js";
import { ico } from "./ui-icons.js";
import { browserBody, siteState } from "./site.js";
import { usd } from "./report.js";

const $ = (id) => document.getElementById(id);
const HOME = "qidirbek.uz";
const MAX_TABS = 8;
const newTab = (url = HOME) => ({ url, back: [], fwd: [], q: "", found: null, dnsDraft: null });
const tabs = [newTab()];
let nav = tabs[0];                                    // faol tab
const shared = { clip: "", visited: false, showPw: {} };          // bufer va h.k. — hamma tablar uchun bitta
const ZONES = ["uz", "com", "dev", "io", "org"];
const DOMAIN_RE = new RegExp(`^[a-z0-9][a-z0-9-]{1,30}\\.(${ZONES.join("|")})$`);

// Boshqa bo'limlardan ochish (masalan 🚀 oynasidan): faol tab bo'sh bo'lsa — shu yerda, aks holda yangi tabda
export function openUrl(url) {
  if (nav.url === HOME || tabs.length >= MAX_TABS) go(url);
  else openTab(url);
}

function openTab(url) {
  if (tabs.length >= MAX_TABS) { go(url); return; }
  const t = newTab();
  tabs.splice(tabs.indexOf(nav) + 1, 0, t);
  nav = t;
  if (url && url !== HOME) go(url, false);
}

function closeTab(k) {
  const t = tabs[k];
  tabs.splice(k, 1);
  if (!tabs.length) tabs.push(newTab());
  if (t === nav) nav = tabs[Math.min(k, tabs.length - 1)];
}

function go(url, push = true) {
  url = String(url || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") || HOME;
  if (push && url !== nav.url) { nav.back.push(nav.url); nav.fwd = []; }
  nav.url = url;
}

const host = (u) => u.split("/")[0].replace(/^www\./, "");
const path = (u) => u.slice(u.split("/")[0].length) || "/";

function checkDomain(name, data) {
  name = name.trim().toLowerCase();
  if (!name.includes(".")) name += ".uz";
  if (!DOMAIN_RE.test(name)) return { name, ok: false, free: false, why: "Nom noto'g'ri: lotin harf, raqam va '-', oxirida zona (.uz, .com ...)" };
  const free = !(data.taken_domains || []).includes(name.split(".")[0]);
  return { name, ok: true, free, why: free ? "" : "Band — boshqa egaga tegishli" };
}

// ---------------- sahifalar ----------------
function qidirbek(state) {
  const L = state.launch, u = state.profile?.gh_user || "men";
  const tiles = [
    ["bulutxon.uz", "Bulutxon", "server", "Serverlar ijarasi (VPS)"],
    ["domenchi.uz", "Domenchi", "globe", "Domen sotib olish va DNS"],
    [`github.com/${u}/${state.ctx.project}`, "GitHub", "git", "Kodingiz"],
    ...(L.domain ? [[L.domain, L.domain, "store", "Sizning saytingiz"]] : []),
  ];
  return `<div class="wq">
    <div class="wq-logo">${[..."Qidirbek"].map((ch, k) => `<b style="color:${["#e2574c", "#f0a500", "#2f9e5b", "#2f7fd1", "#8e5bd6"][k % 5]}">${ch}</b>`).join("")}<span class="wq-hat">🧢</span></div>
    <p class="wq-sub">Hammasini topadi — hatto yo'qolgan paypog'ingizni ham. <span class="muted">(paypoq hali beta)</span></p>
    <form class="wq-form" data-form="search"><input name="q" value="${esc(nav.q)}" placeholder="Qidiring yoki manzil yozing: domen, server, hosting..." autocomplete="off"><button>${ico("search", 16)}</button></form>
    <div class="wq-tiles">${tiles.map(([url, t, i, s]) => `<button class="wq-tile" data-go="${esc(url)}"><span>${ico(i, 22)}</span><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join("")}</div>
  </div>`;
}

function searchResults(q, state) {
  const r = [
    { url: "bulutxon.uz", t: "Bulutxon — VPS serverlar ijarasi. Toshkent data-markazi", d: "Server 1 daqiqada tayyor. Kuniga $20 dan. IP manzil, root kirish, 24/7 ishlaydi.", k: /server|vps|hosting|xosting|bulut|ijara|ip/ },
    { url: "domenchi.uz", t: "Domenchi.uz — domen olmoq non olmoqdek oson", d: ".uz, .com, .dev domenlar — yiliga $15. DNS boshqaruvi bepul.", k: /domen|domain|dns|\.uz|sayt nomi|manzil/ },
    { url: `github.com/${state.profile?.gh_user || "men"}`, t: "GitHub — kodingiz uchun uy", d: "Repo, kommitlar, push — dasturchilar kodini shu yerda saqlaydi.", k: /git|kod|repo/ },
  ];
  const hit = r.filter((x) => x.k.test(q));
  return `<div class="wq-res"><form class="wq-form small" data-form="search"><input name="q" value="${esc(q)}"><button>${ico("search", 14)}</button></form>
    <p class="muted small">Taxminan ${hit.length ? hit.length * 1240 : 0} ta natija (0,42 soniya)</p>
    ${(hit.length ? hit : r).map((x) => `<div class="wq-hit"><small>https://${esc(x.url)}</small><button class="wq-a" data-go="${esc(x.url)}">${esc(x.t)}</button><p>${esc(x.d)}</p></div>`).join("")}
    ${hit.length ? "" : `<p class="muted">"${esc(q)}" bo'yicha aniq natija yo'q — yuqoridagilar foydali bo'lishi mumkin.</p>`}</div>`;
}

function bulutxon(state, data, p) {
  const servers = state.blocks.filter((b) => b.kind === "server");
  const tiers = data.catalog.servers;
  const top = `<div class="wb-top bx"><b class="wb-brand">${ico("server", 18)} Bulutxon</b>
    <span class="wb-menu"><button data-go="bulutxon.uz">Tariflar</button><button data-go="bulutxon.uz/panel">Serverlarim${servers.length ? ` (${servers.length})` : ""}</button></span>
    <span class="wb-acc">${ico("user", 13)} ${esc(state.profile?.gh_user || "mehmon")}</span></div>`;
  if (p.startsWith("/panel")) {
    return top + `<div class="wb-body"><h2>Mening serverlarim</h2>
      ${servers.length ? `<table class="wb-table"><thead><tr><th>Nomi</th><th>IP manzil</th><th>Kirish (SSH)</th><th>Tarif</th><th>Joy</th><th>Holat</th><th></th></tr></thead><tbody>
        ${servers.map((s) => { const t = tiers[s.config.tier] || {}; return `<tr><td><b>${esc(s.name)}</b></td>
          <td><code class="wb-ip">${esc(s.ip)}</code> <button class="wb-copy" data-copy="${esc(s.ip)}" title="Nusxalash">${ico("copy", 12)} ${shared.clip === s.ip ? "nusxalandi" : "nusxalash"}</button></td>
          <td class="wb-cred"><span>login: <code>${esc(s.login)}</code></span>
            <span>parol: <code class="wb-pw">${shared.showPw[s.id] ? esc(s.password) : "••••-••••-••••"}</code>
              <button class="wb-copy" data-showpw="${s.id}" title="Ko'rsatish / yashirish">${ico("eye", 12)}</button>
              <button class="wb-copy" data-copypw="${esc(s.password)}" title="Parolni nusxalash">${ico("copy", 12)}</button></span></td>
          <td>${esc(t.title || s.config.tier)} · ${t.cpu} CPU · ${(t.ram_mb / 1024).toFixed(0)} GB<br><small class="muted">$${t.rent}/kun</small></td>
          <td>Toshkent DC-1</td><td><span class="wb-on">● ishlayapti</span>${s.config.public ? "" : `<br><small class="neg">ichki IP</small>`}</td>
          <td><button class="wb-del" data-cancel="${s.id}" data-name="${esc(s.name)}" data-ip="${esc(s.ip)}" data-apps="${state.blocks.filter((b) => b.host === s.id).length}" title="Serverni o'chirish">${ico("trash", 14)}</button></td></tr>`; }).join("")}
        </tbody></table>
        <div class="wb-note">${ico("terminal", 14)} Serverga kirish: terminalda <code>ssh root@${esc(servers[0].ip)}</code> → keyin shu <b>parol</b>ni yozasiz
          (yozayotganda ekranda ko'rinmaydi — bu odatiy). Parolni hech kimga bermang: kimda bo'lsa, server o'shaniki.</div>`
      : `<div class="wb-empty">Sizda hali server yo'q. <button class="link" data-go="bulutxon.uz">Tarif tanlang →</button></div>`}</div>`;
  }
  return top + `<div class="wb-hero bx"><h1>Serveringiz bulutda — siz esa xotirjam uxlang</h1>
      <p>Server — internetga ulangan, hech qachon o'chmaydigan kompyuter. Saytingiz shu yerda yashaydi.</p></div>
    <div class="wb-body"><div class="wb-plans">${Object.entries(tiers).map(([k, t]) => `<div class="wb-plan ${k === "orta" ? "best" : ""}">
      ${k === "orta" ? `<span class="wb-tag">Ko'p tanlanadi</span>` : ""}<h3>${esc(t.title)}</h3>
      <div class="wb-price">$${t.rent}<small>/kun</small></div>
      <ul><li>${t.cpu} vCPU</li><li>${(t.ram_mb / 1024).toFixed(0)} GB RAM</li><li>Ochiq IP manzil</li><li>Ubuntu 24.04</li></ul>
      <button class="wb-btn" data-rent="${k}" ${state.room.coins < t.rent ? "disabled" : ""}>${state.room.coins < t.rent ? "pul yetmaydi" : "Ijaraga olish"}</button></div>`).join("")}</div>
      <p class="muted small">Ijara har soat balansdan yechiladi. Server olgan zahotiyoq doskangizda ham <b>Server</b> bloki paydo bo'ladi.</p></div>`;
}

function domenchi(state, data, p) {
  const L = state.launch;
  const top = `<div class="wb-top dx"><b class="wb-brand">${ico("globe", 18)} Domenchi<span>.uz</span></b>
    <span class="wb-menu"><button data-go="domenchi.uz">Domen qidirish</button><button data-go="domenchi.uz/panel">Mening domenlarim${L.domain ? " (1)" : ""}</button></span>
    <span class="wb-acc">${ico("user", 13)} ${esc(state.profile?.gh_user || "mehmon")}</span></div>`;
  if (p.startsWith("/panel")) {
    if (!L.domain) return top + `<div class="wb-body"><h2>Mening domenlarim</h2><div class="wb-empty">Sizda hali domen yo'q. <button class="link" data-go="domenchi.uz">Domen qidirish →</button></div></div>`;
    const ip = nav.dnsDraft ?? (L.dns_ip || "");
    return top + `<div class="wb-body"><h2>${esc(L.domain)} <small class="wb-on">● faol · 1 yilga</small>
        <button class="wb-del wb-del-txt" id="dropDomain" title="Domendan voz kechish">${ico("trash", 13)} O'chirish</button></h2>
      <h3>DNS yozuvlari</h3>
      <p class="muted small">DNS — internetning telefon kitobi: domen nomini serverning IP raqamiga aylantiradi.</p>
      <table class="wb-table wb-dns"><thead><tr><th>Turi</th><th>Nom (host)</th><th>Qiymat</th><th>TTL</th><th></th></tr></thead><tbody>
        <tr class="${L.dns_ip ? "" : "wb-need"}"><td><b>A</b></td><td>@</td>
          <td><input id="dnsIp" value="${esc(ip)}" placeholder="server IP, masalan 203.0.113.10" autocomplete="off" spellcheck="false"></td><td>3600</td>
          <td><button class="wb-btn small" id="dnsSave">Saqlash</button></td></tr>
        <tr><td><b>A</b></td><td>www</td><td><code>${esc(L.dns_ip || "— (@ bilan bir xil)")}</code></td><td>3600</td><td></td></tr>
        <tr class="muted"><td>NS</td><td>@</td><td>ns1.domenchi.uz, ns2.domenchi.uz</td><td>86400</td><td></td></tr>
      </tbody></table>
      ${shared.clip ? `<div class="wb-note">${ico("copy", 13)} Buferda: <code>${esc(shared.clip)}</code> <button class="link" id="dnsPaste">qo'yish (Ctrl+V)</button></div>` : ""}
      ${L.dns_ip ? `<div class="wb-ok">${ico("check", 14)} <div><b>${esc(L.domain)} → ${esc(L.dns_ip)}</b> · Endi manzil qatoriga <button class="link" data-go="${esc(L.domain)}">${esc(L.domain)}</button> yozib ko'ring.
          <br><small class="muted">Real hayotda DNS o'zgarishi 5 daqiqadan 24 soatgacha tarqaladi (o'yinda — darhol).</small></div></div>`
        : `<div class="wb-note warn">${ico("alert", 14)} A yozuvi bo'sh — domen hech qaysi serverga qaramayapti. IP ni <button class="link" data-go="bulutxon.uz/panel">Bulutxon → Serverlarim</button> dan nusxalang.</div>`}
    </div>`;
  }
  const r = nav.found;
  const sugg = r && r.ok ? [`${r.name.split(".")[0]}shop.uz`, `${r.name.split(".")[0]}.com`, `get${r.name.split(".")[0]}.uz`].map((x) => checkDomain(x, data)).filter((x) => x.free) : [];
  const row = (d) => `<div class="wd-row ${d.free ? "free" : "taken"}"><b>${esc(d.name)}</b>
    ${d.free ? `<span class="wb-on">bo'sh</span><span class="wd-price">$15<small>/yil</small></span>
      <button class="wb-btn small" data-buy="${esc(d.name)}" ${L.domain === d.name ? "disabled" : ""}>${L.domain === d.name ? "sizniki" : "Sotib olish"}</button>`
      : `<span class="neg">${esc(d.why)}</span>`}</div>`;
  return top + `<div class="wb-hero dx"><h1>Domen olmoq — non olmoqdek oson</h1>
      <p>Domen — saytingizning manzili. Odamlar IP raqamni eslab qololmaydi, <b>nom</b>ni esa eslaydi.</p>
      <form class="wd-form" data-form="domain"><input name="d" value="${esc(r?.name || nav.q || state.ctx.project)}" placeholder="saytingiz nomi" autocomplete="off" spellcheck="false">
        <button class="wb-btn">${ico("search", 14)} Tekshirish</button></form>
      <small>Zonalar: ${ZONES.map((z) => "." + z).join(" ")} · hammasi $15 / yil</small></div>
    <div class="wb-body">${r ? row(r) + (sugg.length ? `<h3>Boshqa variantlar</h3>${sugg.map(row).join("")}` : "") : `<p class="muted">Nom yozing va "Tekshirish" ni bosing.</p>`}
      ${L.domain && L.domain !== r?.name ? `<div class="wb-note">${ico("info", 13)} Sizda <b>${esc(L.domain)}</b> bor. Yangisini olsangiz — eski domen o'rniga shu ishlatiladi.</div>` : ""}</div>`;
}

function github(state) {
  return `<div class="wg"><div class="wg-top">${ico("git", 20)} <b>GitHub</b></div>
    <div class="wb-body"><h2>${esc(nav.url.replace("github.com/", ""))}</h2>
    <p>Repo sahifasini o'yindagi <b>Git</b> bo'limida ko'rasiz — u GitHub'ning o'zidek ishlaydi.</p>
    <button class="wb-btn" data-tab="git">${ico("git", 14)} Git bo'limini ochish</button></div></div>`;
}

function chromeError(h, code, text, why) {
  return `<div class="cr-err"><div class="cr-ico">${ico("alert", 40)}</div><h2>This site can't be reached</h2><p>${text}</p>
    <code>${code}</code><div class="cr-btn">Reload</div></div>${why ? `<div class="br-why">${ico("info", 14)}<div>${why}</div></div>` : ""}`;
}

function pageHtml(state, data) {
  const u = nav.url, h = host(u), p = path(u), L = state.launch;
  if (h === "qidirbek.uz" && p.startsWith("/search")) return { title: `${nav.q} — Qidirbek`, ico: "search", html: searchResults(nav.q, state) };
  if (h === "qidirbek.uz") return { title: "Yangi tab", ico: "search", html: qidirbek(state) };
  if (h === "bulutxon.uz") return { title: "Bulutxon — serverlar", ico: "server", html: bulutxon(state, data, p) };
  if (h === "domenchi.uz") return { title: "Domenchi.uz", ico: "globe", html: domenchi(state, data, p) };
  if (h === "github.com") return { title: "GitHub", ico: "git", html: github(state) };
  if (L.domain && h === L.domain) {
    shared.visited = true;
    const biz = data.catalog.businesses[state.business.key];
    const st = siteState(state);
    return { title: st.kind === "ok" ? state.room.name : L.domain, ico: st.kind === "ok" ? "store" : "alert", html: browserBody(state, data, biz, state.business.offers), own: true };
  }
  if (["127.0.0.1", "localhost"].includes(h.split(":")[0])) {
    return { title: h, ico: "alert", html: chromeError(h, "ERR_CONNECTION_REFUSED", `<b>${esc(h)}</b> refused to connect.`,
      `<b>Nima bo'ldi:</b> 127.0.0.1 — <i>sizning o'z kompyuteringiz</i>. U yerda <code>runserver</code> ishlamayapti. Lokal sayt — <b>Dars</b> bo'limida.`) };
  }
  const c = checkDomain(h, data);
  if (c.ok && !c.free) {
    return { title: h, ico: "globe", html: `<div class="wo"><h1>${esc(h)}</h1><p>Bu — boshqa kompaniyaning sayti. Domen band, uni sotib ololmaysiz.</p>
      <p class="muted small">Har domenning faqat bitta egasi bo'ladi. O'zingizga boshqa nom tanlang: <button class="link" data-go="domenchi.uz">domenchi.uz</button></p></div>` };
  }
  return { title: h, ico: "alert", html: chromeError(h, "DNS_PROBE_FINISHED_NXDOMAIN", `<b>${esc(h)}</b>'s server IP address could not be found.`,
    c.ok ? `<b>Nima bo'ldi:</b> bunday domen hech kimga tegishli emas — DNS uning IP sini bilmaydi. ${c.free ? `Xohlasangiz, <button class="link" data-go="domenchi.uz">domenchi.uz</button> da sotib olishingiz mumkin.` : ""}` : "") };
}

function peek(t, state, data) {
  const keep = nav, seen = shared.visited;
  nav = t;
  try { return pageHtml(state, data); } finally { nav = keep; shared.visited = seen; }
}

// O'ngdagi yo'riqnoma: saytni internetga ulash bosqichlari
function missionHtml(state) {
  const L = state.launch, servers = state.blocks.filter((b) => b.kind === "server");
  const steps = [
    [servers.length > 0, "Server ijaraga oling", "bulutxon.uz", "Saytingiz yashaydigan kompyuter"],
    [!!shared.clip || !!L.dns_ip, "Server IP sini nusxalang", "bulutxon.uz/panel", "Serverlarim → nusxalash"],
    [!!L.domain, "Domen sotib oling", "domenchi.uz", "Saytingiz nomi, masalan mydokon.uz"],
    [!!L.dns_ip, "A yozuvi: @ → server IP", "domenchi.uz/panel", "Domen shu serverga qarasin"],
    [shared.visited && !!L.dns_ip, "Saytingizni oching", L.domain || "domenchi.uz", "Manzil qatoriga domenni yozing"],
  ];
  const cur = steps.findIndex((s) => !s[0]);
  return `<section class="card wm">
    <h3>${ico("rocket", 15)} Saytni internetga ulash</h3>
    <p class="muted small">Real dasturchi aynan shunday qiladi: hosting saytida server, domen do'konida domen, keyin ularni DNS bilan bog'laydi.</p>
    ${steps.map(([ok, t, url, s], i) => `<button class="wm-s ${ok ? "ok" : i === cur ? "now" : ""}" data-go="${esc(url)}">
      <span class="wm-n">${ok ? ico("check", 11) : i + 1}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></button>`).join("")}
    <div class="wm-flow"><b>Mijoz saytingizni ochganda:</b>
      <ol><li>brauzer DNS dan so'raydi: <code>${esc(L.domain || "mydokon.uz")}</code> qaysi IP da?</li>
      <li>DNS A yozuvi javob beradi: <code>${esc(L.dns_ip || "203.0.113.10")}</code></li>
      <li>brauzer shu IP dagi serverga ulanadi → Nginx → Django → javob</li></ol></div>
    <p class="muted small">Keyingi: 🚀 GitHub → Deploy → SSL (Doskadagi qator).</p>
  </section>`;
}

export function renderWeb(state, data, ui, actions) {
  const root = $("page-web");
  const pg = pageHtml(state, data);
  const L = state.launch;
  const secure = pg.own ? L.done.ssl : !["127.0.0.1", "localhost"].includes(host(nav.url).split(":")[0]) && !pg.html.includes("cr-err");
  const bm = [["bulutxon.uz", "server", "Bulutxon"], ["domenchi.uz", "globe", "Domenchi"], [`github.com/${state.profile?.gh_user || "men"}`, "git", "GitHub"],
    ...(L.domain ? [[L.domain, "store", L.domain]] : [])];
  root.innerHTML = `
    <section class="wbr card">
      <div class="br-tabs wtabs"><span class="br-dots"><i></i><i></i><i></i></span>
        ${tabs.map((t, k) => { const tp = t === nav ? pg : peek(t, state, data); return `<span class="br-tab wtab ${t === nav ? "on" : ""}" data-wtab="${k}" title="${esc(t.url)}">
          ${ico(tp.ico, 12)}<span class="wtab-t">${esc(tp.title)}</span><button class="wtab-x" data-wclose="${k}" title="Tabni yopish">×</button></span>`; }).join("")}
        <button class="br-plus wtab-new" id="wNew" title="Yangi tab (${tabs.length}/${MAX_TABS})" ${tabs.length >= MAX_TABS ? "disabled" : ""}>+</button></div>
      <div class="br-bar wbr-bar">
        <span class="br-nav"><button id="wBack" ${nav.back.length ? "" : "disabled"} title="Orqaga">${ico("arrowLeft", 15)}</button>
          <button id="wFwd" ${nav.fwd.length ? "" : "disabled"} title="Oldinga">${ico("arrowRight", 15)}</button>
          <button id="wReload" title="Yangilash">${ico("reset", 14)}</button></span>
        <form class="wbr-url ${secure ? "secure" : ""}" id="wUrlForm">${secure ? ico("lock", 12) : pg.own && L.domain ? `<span class="br-ns">${ico("alert", 12)} Not secure</span>` : ico("info", 12)}
          <input id="wUrl" value="${esc(nav.url)}" autocomplete="off" spellcheck="false" aria-label="Manzil"></form>
        <button class="wbr-home" data-go="qidirbek.uz" title="Bosh sahifa">${ico("search", 14)}</button>
      </div>
      <div class="wbr-bm">${bm.map(([u, i, t]) => `<button data-go="${esc(u)}">${ico(i, 12)} ${esc(t)}</button>`).join("")}</div>
      <div class="wbr-body">${pg.html}</div>
    </section>
    ${missionHtml(state)}`;

  const rerender = () => renderWeb(state, data, ui, actions);
  const goTo = (u) => { go(u); nav.dnsDraft = null; rerender(); };
  // Ctrl/⌘ + bosish yoki g'ildirak bilan bosish — havola yangi tabda ochiladi
  root.querySelectorAll("[data-go]").forEach((b) => {
    b.onclick = (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) { openTab(b.dataset.go); rerender(); } else goTo(b.dataset.go); };
    b.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); openTab(b.dataset.go); rerender(); } };
  });
  root.querySelectorAll("[data-wtab]").forEach((el) => el.onclick = (e) => {
    if (e.target.closest("[data-wclose]")) return;
    nav = tabs[Number(el.dataset.wtab)];
    rerender();
  });
  root.querySelectorAll("[data-wclose]").forEach((b) => b.onclick = () => { closeTab(Number(b.dataset.wclose)); rerender(); });
  $("wNew").onclick = () => { openTab(HOME); rerender(); setTimeout(() => root.querySelector(".wq-form input")?.focus(), 30); };
  root.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => actions.tab(b.dataset.tab));
  $("wUrlForm").onsubmit = (e) => {
    e.preventDefault();
    const val = $("wUrl").value.trim();
    if (!val.includes(".") && !val.includes("/")) { nav.q = val; goTo("qidirbek.uz/search"); } else goTo(val);
  };
  $("wBack").onclick = () => { if (nav.back.length) { nav.fwd.push(nav.url); go(nav.back.pop(), false); rerender(); } };
  $("wFwd").onclick = () => { if (nav.fwd.length) { nav.back.push(nav.url); go(nav.fwd.pop(), false); rerender(); } };
  $("wReload").onclick = rerender;
  root.querySelectorAll('[data-form="search"]').forEach((f) => f.onsubmit = (e) => {
    e.preventDefault();
    const q = f.q.value.trim();
    if (!q) return;
    if (/^[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(q)) goTo(q); else { nav.q = q; goTo("qidirbek.uz/search"); }
  });
  const df = root.querySelector('[data-form="domain"]');
  if (df) df.onsubmit = (e) => { e.preventDefault(); nav.found = checkDomain(df.d.value, data); rerender(); };
  root.querySelectorAll("[data-buy]").forEach((b) => b.onclick = async () => {
    if (!confirm(`${b.dataset.buy} — $15 / yil. Umumiy balansdan yechiladi (sizda ${usd(state.room.coins)}). Sotib olasizmi?`)) return;
    const r = await actions.web("buy_domain", { name: b.dataset.buy });
    if (r) goTo("domenchi.uz/panel");
  });
  root.querySelectorAll("[data-rent]").forEach((b) => b.onclick = async () => {
    const t = data.catalog.servers[b.dataset.rent];
    if (!confirm(`${t.title}: $${t.rent}/kun. Ijara shu paytdan balansdan yechila boshlaydi. Olasizmi?`)) return;
    const r = await actions.web("rent", { tier: b.dataset.rent });
    if (r) goTo("bulutxon.uz/panel");
  });
  root.querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => {
    shared.clip = b.dataset.copy;
    try { navigator.clipboard?.writeText(shared.clip); } catch { /* bo'sh */ }
    actions.toast(`Nusxalandi: ${shared.clip} — endi Domenchi.uz → DNS ga qo'ying`, false);
    rerender();
  });
  root.querySelectorAll("[data-showpw]").forEach((b) => b.onclick = () => { shared.showPw[b.dataset.showpw] = !shared.showPw[b.dataset.showpw]; rerender(); });
  root.querySelectorAll("[data-copypw]").forEach((b) => b.onclick = () => {
    try { navigator.clipboard?.writeText(b.dataset.copypw); } catch { /* bo'sh */ }
    shared.pw = b.dataset.copypw;
    actions.toast("Parol nusxalandi — terminalda ssh dan keyin Ctrl+V bilan qo'ying", false);
  });
  root.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => {
    const apps = Number(b.dataset.apps);
    if (!confirm(`${b.dataset.name} (${b.dataset.ip}) serverini o'chirasizmi?\n\nIjara to'xtaydi.${apps ? ` Ichidagi ${apps} ta dastur (Nginx, Sayt, baza...) ham butunlay o'chadi.` : ""}\nBu qaytarilmaydi.`)) return;
    actions.web("cancel_server", { id: Number(b.dataset.cancel) });
  });
  if ($("dropDomain")) $("dropDomain").onclick = async () => {
    if (!confirm(`${L.domain} domenidan voz kechasizmi?\n\nTo'langan $15 qaytarilmaydi, sayt bu nom bilan ochilmay qoladi.`)) return;
    const r = await actions.web("drop_domain", {});
    if (r) goTo("domenchi.uz");
  };
  const ipIn = $("dnsIp");
  if (ipIn) {
    ipIn.oninput = () => { nav.dnsDraft = ipIn.value; };
    if ($("dnsPaste")) $("dnsPaste").onclick = () => { ipIn.value = shared.clip; nav.dnsDraft = shared.clip; ipIn.focus(); };
    const save = async () => { const r = await actions.web("dns", { ip: ipIn.value }); if (r) { nav.dnsDraft = null; rerender(); } };
    $("dnsSave").onclick = save;
    ipIn.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } };
  }
}
