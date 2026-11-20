// =========================================================================
// local.js — 🎓 DARS: "0 dan Django loyiha" (alohida sahifa).
// Haqiqiy dasturchi qanday ishlasa, shunday: PyCharm ko'rinishi — yuqorida muharrir,
// pastda terminal, o'ngda Project (papka o'sib boradi) va brauzer (127.0.0.1:8000).
//   * terminal vazifalari: mkdir, venv, pip, startproject, runserver, migrate, git ...
//   * muharrir vazifalari: settings.py → views.py → app/urls.py → config/urls.py → home.html → models.py → admin.py
// Har qadamdan keyin "Nima bo'ldi" va "Tushundim" — keyin keyingisi ochiladi.
// Bajarilgan qadamni chapdagi ro'yxatdan bosib QAYTA KO'RISH mumkin (buyruq, natija, izoh, papka holati).
// Boshida — GitHub username so'raladi (prompt va repo manzilida shu nom ishlatiladi).
// "Noldan" startupda progress serverda saqlanadi (POST /api/dev), boshqa startupda — mashq (brauzerda).
// =========================================================================
import { esc, highlight } from "./tpl.js";
import { ico, fileIco } from "./ui-icons.js";
import { mountTerm, fill } from "./term.js";
import { baseLines, applyTask, checkFile } from "./djfiles.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRACTICE_KEY = "vallum.lesson";
const same = (a, b) => a.replace(/\s+/g, "").replace(/'/g, '"') === b.replace(/\s+/g, "").replace(/'/g, '"');
const langOf = (f) => (f.endsWith(".html") ? "html" : "python");

let mounted = null;      // "roomId:rejim:user" — poll har 5 s da render qiladi, terminal qayta chizilmasin

function practiceGet() { try { return Number(localStorage.getItem(PRACTICE_KEY)) || 0; } catch { return 0; } }
function practiceSet(n) { try { localStorage.setItem(PRACTICE_KEY, String(n)); } catch { /* bo'sh */ } }

// Tez takrorlash: darsni bir marta o'tgan odam yodda qolishi uchun boshidan, "Tushundim"siz,
// buyruqlarni ketma-ket yozadi. Startupga ta'sir qilmaydi. Yonda — rangli jarayon logi.
const REPLAY_KEY = "vallum.lesson.replay";
function replayGet() { try { const r = localStorage.getItem(REPLAY_KEY); return r === null ? null : Number(r) || 0; } catch { return null; } }
function replaySet(n) { try { if (n === null) localStorage.removeItem(REPLAY_KEY); else localStorage.setItem(REPLAY_KEY, String(n)); } catch { /* bo'sh */ } }
const REPLAY_NAME = "vallum.lesson.replayname";     // tez rejimda o'yinchi tanlagan loyiha nomi
function nameGet() { try { return localStorage.getItem(REPLAY_NAME) || ""; } catch { return ""; } }
function nameSet(n) { try { if (n) localStorage.setItem(REPLAY_NAME, n); else localStorage.removeItem(REPLAY_NAME); } catch { /* bo'sh */ } }
let journal = [];        // jarayon logi: {kind: ok|err|info, cmd, text, at}

function journalHtml() {
  if (!journal.length) return `<div class="lj-empty muted small">Buyruq yozing — har biri shu yerda chiqadi:
    <span class="lj-k ok">yashil</span> bajarildi, <span class="lj-k err">qizil</span> xato, <span class="lj-k info">ko'k</span> ma'lumot.</div>`;
  return journal.slice().reverse().map((e) => `<div class="lj-row ${e.kind}">
      <div class="lj-top"><span class="lj-k ${e.kind}">${e.kind === "ok" ? "✓ bajarildi" : e.kind === "err" ? "✗ xato" : "i ma'lumot"}</span>
        <code>${esc(e.cmd)}</code><time>${e.at}</time></div>
      ${e.text ? `<div class="lj-t">${esc(e.text)}</div>` : ""}</div>`).join("");
}

// n ta vazifadan keyin papkada nima bor
function treeAfter(tasks, n, v) {
  const items = [];
  tasks.slice(0, n).forEach((t) => (t.tree || []).forEach((x) => items.push(fill(x, v))));
  return items;
}

function explorerHtml(tasks, n, v) {
  const items = treeAfter(tasks, n, v);
  if (!items.length) return `<div class="lx-empty">${ico("folder", 28)}<span>Hali hech narsa yo'q.<br>Birinchi buyruq — papka yaratish.</span></div>`;
  const [root, ...rest] = items;
  const fresh = new Set(items.slice(treeAfter(tasks, Math.max(0, n - 1), v).length));
  // ichma-ich daraxt: config/settings.py → config/ ichida
  const kids = (prefix) => rest.filter((p) => {
    if (!p.startsWith(prefix) || p === prefix) return false;
    const tail = p.slice(prefix.length).replace(/\/$/, "");
    return !tail.includes("/");
  }).sort((a, b) => (b.endsWith("/") - a.endsWith("/")) || a.localeCompare(b));
  const row = (path, depth) => {
    const dir = path.endsWith("/");
    const name = path.replace(/\/$/, "").split("/").pop();
    return `<div class="lx-row ${fresh.has(path) ? "new" : ""} ${dir ? "" : "lx-file"}" ${dir ? "" : `data-file="${esc(path)}" title="Ochish (faqat ko'rish)"`} style="padding-left:${depth * 14 + 8}px">
      ${dir ? ico(depth ? "folder" : "folderOpen", 14, "fi fi-dir") : fileIco(name, 14)} <span>${esc(name)}</span>
      ${fresh.has(path) ? `<em>yangi</em>` : ""}</div>`;
  };
  const walk = (prefix, depth) => kids(prefix).map((p) => row(p, depth) + (p.endsWith("/") && !["venv/", ".git/"].includes(p) ? walk(p, depth + 1) : "")).join("");
  return row(root, 0) + walk("", 1);
}

function stepsHtml(tasks, n, view) {
  let group = "";
  return tasks.map((t, k) => {
    const head = t.group !== group ? `<div class="lc-group">${esc(t.group)}</div>` : "";
    group = t.group;
    const cls = [k < n ? "done" : k === n ? "now" : "", k === view ? "view" : ""].join(" ");
    const label = `${t.kind === "edit" ? `<b class="lc-file">${esc(t.file)}</b> ` : ""}${esc(t.ask.replace(/^[\w/.]+\.(py|html): /, ""))}`;
    const box = `<span class="lc-box">${k < n ? ico("check", 11) : k + 1}</span>`;
    return k < n
      ? `${head}<button class="lc-item ${cls}" data-rev="${k}" title="Qayta ko'rish: nima qilindi va nima bo'ldi">${box}<span>${label}</span>${ico("eye", 13, "lc-eye")}</button>`
      : `${head}<div class="lc-item ${cls}">${box}<span>${label}</span></div>`;
  }).join("");
}

// Brauzer (127.0.0.1:8000) — oxirgi runserver qadamiga qarab
function browserHtml(tasks, n, v) {
  const last = tasks.slice(0, n).filter((t) => t.browser).pop();
  const kind = last?.browser;
  const url = kind === "admin" ? "127.0.0.1:8000/admin/" : "127.0.0.1:8000";
  let body;
  if (!kind) {
    body = `<div class="lw-err">${ico("alert", 26)}<b>This site can't be reached</b>
      <span>127.0.0.1 refused to connect.</span><code>ERR_CONNECTION_REFUSED</code>
      <small>Server hali ishga tushmagan — <code>runserver</code> dan keyin shu yerda sayt ochiladi.</small></div>`;
  } else if (kind === "rocket") {
    body = `<div class="lw-rocket"><div class="lw-dj">django</div>
      <svg viewBox="0 0 64 64" width="64" height="64"><path d="M32 4c10 8 14 20 12 34l-6 8H26l-6-8C18 24 22 12 32 4z" fill="#e8f5e9" stroke="#0c4b33" stroke-width="2"/>
      <circle cx="32" cy="24" r="5" fill="#44b78b"/><path d="M26 46l-6 10 10-4M38 46l6 10-10-4" fill="#ffc107" stroke="#0c4b33" stroke-width="1.5"/></svg>
      <b>The install worked successfully! Congratulations!</b>
      <span>Django ishlayapti. Hali sahifa yozilmagan — shuning uchun standart sahifa.</span></div>`;
  } else if (kind === "home") {
    body = `<div class="lw-home"><h1>Salom, ${esc(v.project)}!</h1><p>Saytimiz tez orada ochiladi.</p>
      <small class="muted">← templates/home.html · views.home · app/urls.py</small></div>`;
  } else {
    body = `<div class="lw-admin"><div class="lw-adh">Django administration <span>WELCOME, ${esc(v.user.toUpperCase())}</span></div>
      <div class="lw-adc">Site administration</div>
      <table><caption>APP</caption><tr><th>Products</th><td>+ Add</td><td>✎ Change</td></tr></table>
      <table><caption>AUTHENTICATION AND AUTHORIZATION</caption><tr><th>Groups</th><td>+ Add</td><td></td></tr>
      <tr><th>Users</th><td>+ Add</td><td></td></tr></table></div>`;
  }
  return `<div class="lw-bar"><span class="br-dots"><i></i><i></i><i></i></span><span class="lw-url">${ico("info", 11)} ${url}</span></div>
    <div class="lw-body">${body}</div>`;
}

function promptAfter(tasks, n, v) {
  let ps = "C:\\Users\\{user}>";
  tasks.slice(0, n).forEach((t) => { if (t.ps) ps = t.ps; });
  return fill(ps, v);
}

function changesOf(t, v) {
  const out = (t.tree || []).map((x) => "+ " + fill(x, v));
  if (t.kind === "edit") out.unshift((t.new ? "+ " : "~ ") + t.file);
  if (t.ps) out.push("prompt: " + fill(t.ps, v));
  if (t.id === "push") out.push(`GitHub: ${v.user}/${v.project}`);
  return out;
}

// Kod ko'rinishi (muharrir yoki qayta ko'rish uchun): "+" qatorlar — shu qadamda qo'shilganlar
function codeRows(lines, lang, cur = -1, done = Infinity) {
  const targets = lines.map((l, k) => (l.startsWith("+") ? k : -1)).filter((k) => k >= 0);
  return lines.map((l, k) => {
    const plus = l.startsWith("+"), text = plus ? l.slice(1) : l;
    const ti = targets.indexOf(k);
    let html, cls = "";
    if (plus && ti === cur) {
      const ind = text.match(/^\s*/)[0];
      html = `<span class="ed-ind">${ind.replace(/ /g, "&nbsp;")}</span><input class="ed-in" id="edIn" spellcheck="false" autocomplete="off"
        placeholder="${esc(text.trim())}" aria-label="Shu qatorni yozing">`;
      cls = "cur";
    } else if (plus && ti > done - 1 && ti !== cur && done !== Infinity) {
      html = `<span class="ed-todo">${text.trim() ? "…" : ""}</span>`;
      cls = "todo";
    } else {
      html = highlight(text, lang) || "&nbsp;";
      cls = plus ? "added" : "";
    }
    return `<div class="ed-l ${cls}"><span class="ed-n">${k + 1}</span><span class="ed-c">${html}</span></div>`;
  }).join("");
}

// PyCharm oynasining yuqori qatori
function pcTop(v, file, extra = "") {
  return `<div class="pc-top"><span class="pc-logo">PC</span><span class="pc-proj">${esc(v.project)} ${ico("chevronDown", 11)}</span>
    <span class="pc-branch">${ico("branch", 12)} main</span><span class="pc-sp"></span>${extra}
    <span class="pc-run" title="Run: runserver">${ico("play", 12)} runserver</span></div>
    ${file ? `<div class="ed-bar">${file}</div>` : ""}`;
}

export function renderLesson(state, data, ui, actions) {
  const page = $("page-lesson");
  const replay = replayGet();
  const real = state.dev.scratch && replay === null;     // takrorlashda startupga tegilmaydi
  const prof = state.profile || { gh_user: "men", set: false };
  const key = `${state.room.id}:${real ? "s" : replay !== null ? "r" : "p"}:${prof.set ? prof.gh_user : "-"}`;
  if (mounted === key && page.querySelector(".les-cols, .les-hello")) return;
  mounted = key;

  const tasks = data.dev_tasks;
  const v = { project: (!real && nameGet()) || state.ctx.project, user: prof.gh_user };
  let n = real ? state.dev.done : replay !== null ? Math.min(replay, tasks.length) : Math.min(practiceGet(), tasks.length);
  const total = tasks.length;
  let view = null;           // qayta ko'rilayotgan qadam (null — joriy ish)

  const head = `
    <section class="card les-head">
      <div class="les-title">
        <span class="les-ico">${ico("cap", 22)}</span>
        <div><h1>Dars · 0 dan Django loyiha</h1>
          <p class="muted">Haqiqiy dasturchi qanday boshlasa — xuddi shunday: terminal, PyCharm, settings.py, urls.py, model, Git.
            Har qadamdan keyin <b>nima bo'lgani</b> tushuntiriladi. Bajarilgan qadamni chapdan bosib <b>qayta ko'rishingiz</b> mumkin.</p></div>
        <span class="les-badge ${real ? "real" : replay !== null ? "fast" : ""}">${real ? `${ico("rocket", 13)} "${esc(state.room.name)}" uchun`
          : replay !== null ? `${ico("play", 13)} Tez takrorlash` : `${ico("book", 13)} Mashq rejimi`}</span>
      </div>
      <div class="les-prog"><i style="width:${(n / total) * 100}%"></i></div>
      <div class="les-sub muted small" id="lesSub"></div>
    </section>`;

  // ---------------- 0: tanishuv — GitHub username ----------------
  if (!prof.set) {
    page.innerHTML = head + `
      <section class="card les-hello">
        <div class="lh-ico">${ico("user", 30)}</div>
        <div class="lh-body">
          <h2>Avval tanishaylik</h2>
          <p>Dasturchining internetdagi "pasporti" — <b>GitHub username</b>. U kompyuteringizdagi papka nomida
            (<code>C:\\Users\\<i>username</i></code>) va kodingiz turadigan manzilda (<code>github.com/<i>username</i>/loyiha</code>) ishlatiladi.</p>
          <p class="muted small">GitHub'da akkauntingiz bo'lsa — o'sha nomni yozing. Bo'lmasa — o'ylab toping (lotin harf, raqam, "-"). Keyin o'zgartirsa bo'ladi.</p>
          <form class="lh-form" id="lhForm">
            <label class="lh-in"><span>github.com/</span><input id="lhUser" maxlength="39" placeholder="masalan: iskandar-dev" autocomplete="off" spellcheck="false"></label>
            <button class="btn primary">${ico("check", 14)} Boshlash</button>
          </form>
          <div class="lh-prev muted small" id="lhPrev">Terminalda shunday ko'rinadi: <code>C:\\Users\\…&gt;</code></div>
        </div>
      </section>`;
    $("lesSub").textContent = `${total} qadam · taxminan 25–30 daqiqa`;
    const inp = $("lhUser");
    inp.focus();
    inp.oninput = () => { $("lhPrev").innerHTML = `Terminalda shunday ko'rinadi: <code>C:\\Users\\${esc(inp.value || "…")}&gt;</code> · repo: <code>github.com/${esc(inp.value || "…")}/${esc(v.project)}</code>`; };
    // saqlangach snapshot'da profile.set = true → kalit o'zgaradi va dars o'zi chiziladi
    $("lhForm").onsubmit = async (e) => { e.preventDefault(); await actions.profile(inp.value); };
    return;
  }

  page.innerHTML = head + `
    <div class="les-cols">
      <aside class="card lc-steps" id="lcSteps">${stepsHtml(tasks, n, view)}</aside>
      <div class="les-ide">
        <div class="ed" id="lesEd"></div>
        <div id="lesTerm"></div>
      </div>
      <aside class="les-side">
        <div class="card les-journal"><div class="lx-head">${ico("log", 14)} Jarayon
          <button class="link lj-clear" id="ljClear">tozalash</button></div><div class="lj-list" id="ljList"></div></div>
        <div class="card lc-explorer"><div class="lx-head">${ico("folderOpen", 14)} Project <span class="muted" id="lxAt"></span></div><div id="lcTree"></div></div>
        <div class="card les-browser" id="lesBrowser"></div>
      </aside>
    </div>`;

  const again = `<button class="btn small primary" id="lesFast">${ico("play", 12)} Boshidan takrorlash (tez rejim)</button>`;
  const sub = () => {
    const done = n >= total;
    if (replay !== null) {
      $("lesSub").innerHTML = done
        ? `${ico("check", 13)} Takrorlash tugadi — ${total} qadam! ${again} <button class="link" id="lesFastEnd">Takrorlashdan chiqish</button>`
        : `${n}/${total} · ${esc(tasks[n].group)} · <b>tez rejim</b>: "Tushundim" yo'q — buyruqlarni ketma-ket yozing, natija o'ngdagi <b>Jarayon</b>da.
          Startupingizga ta'sir qilmaydi. <button class="link" id="lesFastEnd">Takrorlashdan chiqish</button>`;
    } else $("lesSub").innerHTML = done
      ? (real ? `${ico("check", 13)} Loyiha tayyor va GitHub'da. Endi <button class="link" data-go="board">Doska</button> → Server oling va 🚀 bilan internetga chiqaring.
          <button class="link" data-go="code">Kodni ko'rish</button> · <button class="link" data-go="git">Git</button>`
        : `${ico("check", 13)} Mashq tugadi! Endi <b>Yangi g'oya → Noldan</b> startup ochib, shu yo'lni haqiqiy loyiha bilan bosing. <button class="link" id="lesAgain">Qaytadan boshlash</button>`) + " " + again
      : `${n}/${total} qadam · ${esc(tasks[n].group)}${real ? " · progress saqlanadi, sahifadan chiqsangiz ham joyidan davom etasiz"
          : ` · mashq: startupingizga ta'sir qilmaydi <button class="link" id="lesAgain">Qaytadan</button>`}`;
    page.querySelector(".les-prog i").style.width = `${(n / total) * 100}%`;
    page.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => actions.tab(b.dataset.go));
    if ($("lesAgain")) $("lesAgain").onclick = () => { practiceSet(0); nameSet(""); mounted = null; renderLesson(state, data, ui, actions); };
    if ($("lesFast")) $("lesFast").onclick = startFast;
    if ($("lesFastEnd")) $("lesFastEnd").onclick = () => { replaySet(null); nameSet(""); journal = []; mounted = null; renderLesson(state, data, ui, actions); };
  };
  function startFast() {
    replaySet(0);
    nameSet("");
    journal = [];
    mounted = null;
    renderLesson(state, data, ui, actions);
    actions.toast("Tez rejim: boshidan. Buyruqlarni ketma-ket yozing — Tushundim kutilmaydi", false);
  }
  const drawJournal = () => {
    $("ljList").innerHTML = journalHtml();
  };
  $("ljClear").onclick = () => { journal = []; drawJournal(); };

  // o'ng ustun: papka va brauzer — joriy holat yoki qayta ko'rilayotgan qadamdan keyingi holat
  const side = () => {
    const at = view !== null ? view + 1 : n;
    $("lcTree").innerHTML = explorerHtml(tasks, at, v);
    $("lesBrowser").innerHTML = browserHtml(tasks, at, v);
    $("lxAt").textContent = view !== null ? `· ${view + 1}-qadamdan keyin` : "";
    $("lcTree").querySelectorAll("[data-file]").forEach((el) => {
      el.classList.toggle("on", el.dataset.file === fileView);
      el.onclick = () => { fileView = el.dataset.file === fileView ? null : el.dataset.file; side(); drawEditor(); };
    });
  };
  const steps = () => {
    $("lcSteps").innerHTML = stepsHtml(tasks, n, view);
    $("lcSteps").querySelectorAll("[data-rev]").forEach((b) => b.onclick = () => openReview(Number(b.dataset.rev)));
  };
  const refresh = () => {
    steps();
    side();
    $("lcSteps").querySelector(".lc-item.now")?.scrollIntoView({ block: "nearest" });
    sub();
    drawEditor();
  };
  const openReview = (k) => { view = k; steps(); side(); drawEditor(); $("lesEd").scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const closeReview = () => { view = null; steps(); side(); drawEditor(); };

  // ---------------- qayta ko'rish ----------------
  function reviewHtml(k) {
    const t = tasks[k];
    const prev = k > 0, next = k + 1 < n;
    let body;
    if (t.kind === "edit") {
      body = `<div class="rv-file">${ico("fileCode", 13)} ${esc(t.file)} ${t.new ? `<span class="ed-newf">yangi fayl</span>` : ""}
        <span class="muted">· yashil — shu qadamda yozilgan qatorlar</span></div>
        <div class="ed-code">${codeRows(t.code.map((l) => fill(l, v)), langOf(t.file))}</div>`;
    } else {
      const ps = promptAfter(tasks, k, v);
      body = `<pre class="rv-term"><b>${esc(ps)} ${esc(fill(t.cmd, v))}</b>${(t.out || []).length ? "\n" + esc((t.out || []).map((l) => fill(l, v)).join("\n")) : ""}</pre>`;
    }
    const ch = changesOf(t, v);
    return `<div class="rv">
      <div class="rv-head">${ico("eye", 14)} <b>Qayta ko'rish · ${k + 1}/${total}</b> <span class="muted">${esc(t.group)}</span>
        <span class="pc-sp"></span><button class="btn small" id="rvClose">${ico("x", 12)} Joriy qadamga qaytish</button></div>
      <h3>${esc(fill(t.ask, v))}</h3>
      ${body}
      <div class="rv-ex"><div class="tm-ex-h">${ico("info", 14)} Nima bo'ldi</div><p>${esc(fill(t.explain, v))}</p>
        ${t.why ? `<p class="tm-why">${ico("bulb", 13)} ${esc(fill(t.why, v))}</p>` : ""}
        ${ch.length ? `<div class="tm-ch"><span>O'zgardi:</span>${ch.map((c) => `<em class="${c[0] === "+" ? "add" : "mod"}">${esc(c)}</em>`).join("")}</div>` : ""}</div>
      <div class="rv-nav"><button class="btn small" id="rvPrev" ${prev ? "" : "disabled"}>${ico("arrowLeft", 12)} Oldingi</button>
        <span class="muted small">Kompyuterdagi holat: o'ngdagi Project va brauzer — shu qadamdan keyingi ko'rinish</span>
        <button class="btn small" id="rvNext" ${next ? "" : "disabled"}>Keyingi ${ico("arrowRight", 12)}</button></div></div>`;
  }

  // dars tugadi — hamma bo'limlarni ko'rib chiqish
  function finishedHtml() {
    const groups = [...new Set(tasks.map((t) => t.group))];
    return `${pcTop(v, "")}<div class="rv rv-done">
      <h3>${ico("check", 18)} Dars tugadi — ${total} qadam</h3>
      <p class="muted">Istalgan bo'limni qaytadan ko'rib chiqing: qaysi buyruq yozildi, kompyuterda nima o'zgardi va nega.</p>
      <div class="rv-again">${again}<span class="muted small">Yodda qolishi uchun: boshidan, "Tushundim"siz, ketma-ket.</span></div>
      <div class="rv-groups">${groups.map((g) => {
        const k = tasks.findIndex((t) => t.group === g);
        const cnt = tasks.filter((t) => t.group === g).length;
        return `<button class="rv-g" data-g="${k}"><b>${esc(g)}</b><small>${cnt} qadam · ko'rish ${ico("arrowRight", 11)}</small></button>`;
      }).join("")}</div></div>`;
  }

  // ---------------- kompyuterdagi fayllar ----------------
  // Fayl k-qadamdan oldingi holatda: asl fayl (startproject/startapp) + oldingi edit-vazifalar
  // (o'yinchi o'zi saqlagan matn bo'lsa — o'sha, aks holda namuna qo'llanadi)
  const saved = {};               // vazifa raqami → o'yinchi saqlagan qatorlar
  const drafts = {};              // vazifa raqami → hali saqlanmagan matn
  let fileView = null;            // Project'da bosilgan fayl (faqat ko'rish)
  let feKey = null;               // fayl muharririning Ctrl+S tinglovchisi (bittadan ortiq bo'lmasin)
  const dropKey = () => { if (feKey) { document.removeEventListener("keydown", feKey); feKey = null; } };
  function fileAt(path, k) {
    let lines = baseLines(path, v);
    let known = lines !== null;
    tasks.slice(0, k).forEach((t, j) => {
      if (t.kind !== "edit" || t.file !== path) return;
      known = true;
      lines = saved[j] || applyTask(lines || [""], t, v);
    });
    return known ? (lines || [""]) : null;
  }
  const modeGet = () => { try { return localStorage.getItem("vallum.edmode") || "file"; } catch { return "file"; } };
  const modeSet = (m) => { try { localStorage.setItem("vallum.edmode", m); } catch { /* bo'sh */ } };

  function fileViewHtml(path) {
    const at = view !== null ? view + 1 : n;
    const lines = fileAt(path, at);
    const body = lines === null
      ? `<div class="ed-welcome">${ico("file", 26)}<b>${esc(path)}</b><span>Bu faylni Django yoki Python o'zi yaratgan — bu darsda unga tegmaymiz.</span></div>`
      : `<div class="ed-code">${codeRows(lines, langOf(path))}</div>`;
    return `${pcTop(v, `<span class="ed-tab">${fileIco(path, 12)} ${esc(path.split("/").pop())}</span><span class="ed-path muted">${esc(path)}</span>
      <span class="ed-tools"><button class="tm-btn" id="fvClose">${ico("x", 12)} Yopish</button></span>`)}
      <div class="ed-task fv">${ico("eye", 13)} Faqat ko'rish · ${view !== null ? `${view + 1}-qadamdan keyingi holat` : "hozirgi holat"}
        <span class="muted">— o'zgartirish vazifa kelganda (yoki o'zingiz Project'dan boshqa faylni ochib ko'ring)</span></div>${body}`;
  }

  // ---------------- muharrir (PyCharm) ----------------
  let edLine = 0, edTyping = false;
  function drawEditor() {
    const ed = $("lesEd");
    dropKey();
    ed.classList.toggle("reviewing", view !== null);
    if (fileView) {
      ed.innerHTML = fileViewHtml(fileView);
      $("fvClose").onclick = () => { fileView = null; side(); drawEditor(); };
      return;
    }
    if (view !== null) {
      ed.innerHTML = pcTop(v, "") + reviewHtml(view);
      $("rvClose").onclick = closeReview;
      $("rvPrev").onclick = () => openReview(view - 1);
      $("rvNext").onclick = () => openReview(view + 1);
      return;
    }
    if (n >= total) {
      ed.innerHTML = finishedHtml();
      ed.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => openReview(Number(b.dataset.g)));
      if (ed.querySelector("#lesFast")) ed.querySelector("#lesFast").onclick = startFast;
      return;
    }
    const t = tasks[n];
    const opened = n > tasks.findIndex((x) => x.id === "editor");
    if (!opened) {
      ed.innerHTML = `<div class="pc-top off"><span class="pc-logo">PC</span><span class="pc-proj">PyCharm</span></div>
        <div class="ed-welcome">${ico("code", 30)}<b>PyCharm hali ochilmagan</b>
        <span>Avval terminalda loyiha yaratiladi. <code>pycharm .</code> buyrug'idan keyin fayllar shu yerda ochiladi.</span></div>`;
      return;
    }
    const editing = t && t.kind === "edit";
    const src = editing ? t : tasks.slice(0, n).filter((x) => x.kind === "edit").pop();
    if (!src) {
      ed.innerHTML = `${pcTop(v, "")}
        <div class="ed-welcome">${ico("folderOpen", 30)}<b>${esc(v.project)} — PyCharm da ochildi</b>
        <span>O'ngda Project (fayllar). Keyingi qadamlarda <code>config/settings.py</code> dan boshlab kod yozamiz.</span></div>`;
      return;
    }
    if (editing && modeGet() === "file") { drawFileEditor(ed, t); return; }
    const lines = src.code.map((l) => fill(l, v));
    const targets = lines.map((l, k) => (l.startsWith("+") ? k : -1)).filter((k) => k >= 0);
    const all = editing && edLine >= targets.length;
    const fileBar = `<span class="ed-tab">${fileIco(src.file, 12)} ${esc(src.file.split("/").pop())}${editing && !all ? " ●" : ""}</span>
      <span class="ed-path muted">${esc(src.file)}</span>
      ${src.new && editing ? `<span class="ed-newf">yangi fayl</span>` : ""}
      <span class="ed-tools">${editing ? `<button class="tm-btn" id="edMode" title="Haqiqiy faylni ochib, o'zingiz topib yozing">${ico("fileCode", 12)} Faylda yozish</button>` : ""}
        ${editing && !all ? `<button class="tm-btn" id="edDemo">${ico("play", 12)} Yozib ber</button>` : ""}</span>`;
    ed.innerHTML = `${pcTop(v, fileBar)}
      ${editing ? `<div class="ed-task">${ico("edit", 13)} ${esc(t.ask)}
        <span class="muted">${all ? "" : `· yashil qator — siz yozadigan joy (${edLine + 1}/${targets.length}), xira matn — namuna`}</span></div>` : ""}
      <div class="ed-code">${editing ? codeRows(lines, langOf(src.file), all ? -1 : edLine, edLine) : codeRows(lines, langOf(src.file))}</div>
      ${editing && all ? `<div class="ed-save"><button class="btn primary small" id="edSave">${ico("check", 13)} Saqlash <kbd>Ctrl+S</kbd></button>
        <span class="muted small">Fayl o'zgardi — saqlang, keyin nima bo'lganini tushuntiraman.</span></div>` : ""}`;
    if ($("edMode")) $("edMode").onclick = () => { modeSet("file"); drawEditor(); };
    const inp = $("edIn");
    if (inp) {
      const expect = lines[targets[edLine]].slice(1).trim();
      inp.style.width = `${Math.max(expect.length + 2, 12)}ch`;
      setTimeout(() => inp.focus({ preventScroll: true }), 30);
      const check = () => {
        if (same(inp.value, expect)) { edLine += 1; drawEditor(); return; }
        inp.classList.add("bad");
        setTimeout(() => inp.classList.remove("bad"), 500);
        actions.toast("Qator namunadan farq qiladi — xira matnga qarab yozing yoki 'Yozib ber' ni bosing");
      };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); if (!edTyping) check(); }
        else if (e.key === "Tab") { e.preventDefault(); inp.value = expect; }
      });
      inp.addEventListener("input", () => { if (same(inp.value, expect) && !edTyping) setTimeout(() => { if ($("edIn") === inp && same(inp.value, expect)) { edLine += 1; drawEditor(); } }, 350); });
      $("edDemo").onclick = async () => {
        if (edTyping) return;
        edTyping = true;
        inp.value = "";
        for (const ch of expect) { inp.value += ch; await sleep(55); }
        await sleep(450);
        edTyping = false;
        edLine += 1;
        drawEditor();
      };
    }
    const save = $("edSave");
    if (save) {
      save.focus({ preventScroll: true });
      const doSave = async () => {
        save.disabled = true;
        document.removeEventListener("keydown", ctrlS);
        const ok = await term.complete(t);
        if (!ok) save.disabled = false;
      };
      const ctrlS = (e) => { if (e.key === "s" && (e.ctrlKey || e.metaKey) && $("edSave")) { e.preventDefault(); doSave(); } };
      document.addEventListener("keydown", ctrlS);
      save.onclick = doSave;
    }
  }

  // Haqiqiy fayl: butun fayl ochiladi, kerakli joyni o'yinchi o'zi topadi va yozadi (real hayotdagidek)
  function drawFileEditor(ed, t) {
    const k = n;
    const start = fileAt(t.file, k) || [""];
    const text = drafts[k] ?? start.join("\n");
    const fileBar = `<span class="ed-tab">${fileIco(t.file, 12)} ${esc(t.file.split("/").pop())} ●</span>
      <span class="ed-path muted">${esc(v.project)}/${esc(t.file)}</span>
      ${t.new ? `<span class="ed-newf">yangi fayl</span>` : ""}
      <span class="ed-tools">
        <button class="tm-btn" id="feMode" title="Avvalgidek: yashil qatorlarni birma-bir yozish">${ico("edit", 12)} Qadamma-qadam</button>
        <button class="tm-btn" id="feHintBtn" title="Nimani qayerga yozish kerak — namuna">${ico("bulb", 12)} Namuna</button>
        <button class="tm-btn" id="feDemo" title="Tizim o'zi to'g'ri joyga yozib qo'yadi">${ico("play", 12)} Yozib ber</button></span>`;
    ed.innerHTML = `${pcTop(v, fileBar)}
      <div class="ed-task">${ico("edit", 13)} ${esc(fill(t.ask, v))}
        <span class="muted">· ${t.new ? "yangi bo'sh fayl ochildi — kodni yozing" : "butun fayl ochiq: kerakli joyni o'zingiz toping va yozing"}, keyin <b>Ctrl+S</b></span></div>
      <div class="fe-hint hidden" id="feHint"><div class="fe-hint-h">${ico("bulb", 12)} Namuna: yashil — qo'shiladigan qatorlar, oq — atrofidagi kod (shu joyni faylda qidiring)</div>
        <div class="ed-code">${codeRows(t.code.map((l) => fill(l, v)), langOf(t.file))}</div></div>
      <div class="fe"><pre class="fe-gut" id="feGut"></pre><textarea id="feArea" spellcheck="false" autocomplete="off" wrap="off">${esc(text)}</textarea></div>
      <div class="fe-err hidden" id="feErr"></div>
      <div class="ed-save"><button class="btn primary small" id="feSave">${ico("check", 13)} Saqlash <kbd>Ctrl+S</kbd></button>
        <span class="muted small">Saqlaganda tekshiraman: kerakli qatorlar bormi va to'g'ri joydami.</span></div>`;
    const area = $("feArea"), gut = $("feGut");
    const gutter = () => { gut.textContent = area.value.split("\n").map((_, i) => i + 1).join("\n"); gut.scrollTop = area.scrollTop; };
    gutter();
    area.oninput = () => { drafts[k] = area.value; gutter(); };
    area.onscroll = () => { gut.scrollTop = area.scrollTop; };
    // kursor birinchi kerakli joy yaqinida bo'lsin (uzun settings.py da adashmaslik uchun emas — o'zi topsin, shuning uchun boshida)
    setTimeout(() => area.focus({ preventScroll: true }), 30);
    const insert = (str) => {
      const a = area.selectionStart, b = area.selectionEnd;
      area.setRangeText(str, a, b, "end");
      drafts[k] = area.value; gutter();
    };
    const doSave = async () => {
      const lines = area.value.replace(/\r/g, "").split("\n");
      const problems = checkFile(lines, t, v);
      const err = $("feErr");
      if (problems.length) {
        err.classList.remove("hidden");
        err.innerHTML = `<b>${ico("alert", 13)} Hali to'g'ri emas:</b><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <span class="muted small">Qiynalsangiz — <b>Namuna</b> tugmasi: nima va qayerga yozilishini ko'rsatadi.</span>`;
        journal.push({ kind: "err", cmd: `${t.file} (Ctrl+S)`, text: problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} ta)` : ""), at: new Date().toTimeString().slice(0, 8) });
        drawJournal();
        return;
      }
      err.classList.add("hidden");
      $("feSave").disabled = true;
      dropKey();
      saved[k] = lines;
      const ok = await term.complete(t);
      if (!ok) { $("feSave").disabled = false; delete saved[k]; document.addEventListener("keydown", ctrlS); feKey = ctrlS; }
      else delete drafts[k];
    };
    const ctrlS = (e) => { if (e.key === "s" && (e.ctrlKey || e.metaKey) && $("feArea")) { e.preventDefault(); doSave(); } };
    document.addEventListener("keydown", ctrlS);
    feKey = ctrlS;
    area.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { e.preventDefault(); insert("    "); }
      else if (e.key === "Enter") {                 // avtomatik chekinish — PyCharm kabi
        e.preventDefault();
        const before = area.value.slice(0, area.selectionStart);
        const cur = before.slice(before.lastIndexOf("\n") + 1);
        let ind = cur.match(/^\s*/)[0];
        if (/[:[{(]\s*$/.test(cur)) ind += "    ";
        insert("\n" + ind);
      }
    });
    $("feSave").onclick = doSave;
    $("feMode").onclick = () => { modeSet("step"); drawEditor(); };
    $("feHintBtn").onclick = () => $("feHint").classList.toggle("hidden");
    $("feDemo").onclick = () => {
      area.value = applyTask(area.value.replace(/\r/g, "").split("\n"), t, v).join("\n");
      drafts[k] = area.value; gutter();
      $("feErr").classList.add("hidden");
      // yozilgan joyni ko'rsatamiz
      const first = t.code.find((l) => l.startsWith("+"));
      const at = first ? area.value.indexOf(fill(first.slice(1), v).trim()) : -1;
      if (at >= 0) { area.focus(); area.setSelectionRange(at, at + fill(first.slice(1), v).trim().length); }
      actions.toast("Yozib qo'ydim — qayerga yozilganiga qarang, keyin Ctrl+S", false);
    };
  }

  const term = mountTerm($("lesTerm"), {
    tasks, vars: v, ps: promptAfter(tasks, n, v), os: "win", start: n,
    title: replay !== null ? "Terminal: Local — cmd · tez rejim" : "Terminal: Local — cmd", enabled: true,
    demoKey: replay !== null ? null : "vallum.localdemo", gate: replay === null, fast: replay !== null,
    freeName: !real && n === 0,
    onName: (name) => { nameSet(name); },
    onLog: (kind, cmd, text) => {
      const d = new Date();
      journal.push({ kind, cmd, text: text.length > 220 ? text.slice(0, 217) + "…" : text,
        at: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}` });
      journal = journal.slice(-80);
      drawJournal();
    },
    finalLabel: "Loyiha tayyor!",
    listing: () => treeAfter(tasks, n, v).slice(1).filter((x) => !x.slice(0, -1).includes("/")).map((x) => x.replace(/\/$/, "")).join("  "),
    changes: (t) => changesOf(t, v),
    onTask: async (k, t) => {
      if (real) { const res = await actions.dev(t.id); if (!res) return false; }
      else if (replay !== null) replaySet(k + 1);
      else practiceSet(k + 1);
      return true;
    },
    onAdvance: (k) => { n = k; edLine = 0; view = null; fileView = null; refresh(); },
  });
  refresh();
  drawJournal();
}
