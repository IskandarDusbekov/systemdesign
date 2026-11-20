// =========================================================================
// git.js — "Git" sahifasi, GitHub'ga o'xshash:
//   * sarlavha: egasi / repo, Public|Private, Watch / Fork / Star;
//   * "Code" tabi: branch, fayllar ro'yxati (har biri oxirgi kommit bilan), README;
//   * "Commits" tabi: kunlar bo'yicha guruhlangan kommitlar, bosilsa — diff (+/−);
//   * "Security": .env / SECRET_KEY tarixda qolgan bo'lsa — ogohlantirish.
// Bu real Git emas — o'quv daftari: doska va Kod bo'limidagi har o'zgarish kommit bo'ladi.
// =========================================================================
import { esc, renderTpl } from "./tpl.js";
import { ico, fileIco } from "./ui-icons.js";

const $ = (id) => document.getElementById(id);
const view = { tab: "code", open: null, room: null };

function counts(diff) {
  let add = 0, del = 0;
  diff.forEach((l) => { if (l.startsWith("+")) add++; else if (l.startsWith("-")) del++; });
  return { add, del };
}

function avatar(size = 20) {
  return `<span class="gh-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px">M</span>`;
}

// Diff — GitHub uslubida: fayl sarlavhasi, qator raqamlari, +/− ranglar
function diffHtml(c) {
  if (!c.diff.length) return `<div class="gh-diff-empty muted">Bu kommit fayl o'zgartirmagan (amal: push / deploy / DNS).</div>`;
  const { add, del } = counts(c.diff);
  let ln = 0;
  const rows = c.diff.map((l) => {
    const cls = l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
    if (!l.startsWith("-")) ln += 1;
    return `<tr class="${cls}"><td class="gh-ln">${l.startsWith("-") ? "" : ln}</td>
      <td class="gh-sign">${cls === "add" ? "+" : cls === "del" ? "−" : ""}</td><td class="gh-code">${esc(l.replace(/^[+\- ]/, "")) || " "}</td></tr>`;
  }).join("");
  return `<div class="gh-diff">
    <div class="gh-diff-h">${fileIco(c.file || "file")} <b>${esc(c.file || "—")}</b>
      <span class="gh-stat"><span class="pos">+${add}</span> <span class="neg">−${del}</span>${bars(add, del)}</span></div>
    <table>${rows}</table></div>`;
}

function bars(add, del) {
  const total = add + del || 1, n = 5;
  const a = Math.round((add / total) * n), d = Math.min(n - a, Math.round((del / total) * n));
  return `<span class="gh-bars">${"<i class='a'></i>".repeat(a)}${"<i class='d'></i>".repeat(d)}${"<i></i>".repeat(n - a - d)}</span>`;
}

// Papka / fayl uchun oxirgi kommit (kommitlar yangidan eskiga tartiblangan)
function lastCommit(commits, path, dir) {
  return commits.find((c) => c.file && (dir ? c.file.startsWith(path + "/") : c.file === path));
}

function readmeHtml(state, data) {
  const f = data.catalog.project_files.find((x) => x.path === "README.md");
  if (!f || !state.files.includes("README.md")) return "";
  const rows = renderTpl(f.lines, { fields: data.catalog.code_fields, values: { ...state.code, ...state.ctx }, env: state.env, lang: "md" });
  let html = "", pre = [];
  const flush = () => { if (pre.length) { html += `<pre>${pre.map(esc).join("\n")}</pre>`; pre = []; } };
  rows.forEach(({ text }) => {
    if (text.startsWith("    ")) { pre.push(text.slice(4)); return; }
    flush();
    if (text.startsWith("## ")) html += `<h3>${esc(text.slice(3))}</h3>`;
    else if (text.startsWith("# ")) html += `<h2>${esc(text.slice(2))}</h2>`;
    else if (text.trim()) html += `<p>${esc(text)}</p>`;
  });
  flush();
  return `<div class="gh-box gh-readme"><div class="gh-box-h">${ico("book", 15)} README.md</div><div class="gh-md">${html}</div></div>`;
}

function languages(files) {
  const w = { Python: 0, HTML: 0, CSS: 0, Shell: 0 };
  files.forEach((p) => {
    if (p.endsWith(".py")) w.Python += 3; else if (p.endsWith(".html")) w.HTML += 2;
    else if (p.endsWith(".css")) w.CSS += 1; else if (/\.(sh|conf|service)$/.test(p)) w.Shell += 1;
  });
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const col = { Python: "#3572A5", HTML: "#e34c26", CSS: "#663399", Shell: "#89e051" };
  const parts = Object.entries(w).filter(([, x]) => x);
  return `<div class="gh-lang-bar">${parts.map(([k, x]) => `<i style="width:${(x / total) * 100}%;background:${col[k]}"></i>`).join("")}</div>
    <div class="gh-langs">${parts.map(([k, x]) => `<span><i style="background:${col[k]}"></i><b>${k}</b> ${((x / total) * 100).toFixed(1)}%</span>`).join("")}</div>`;
}

function codeTab(state, data, owner, repo) {
  const commits = state.commits;
  const latest = commits[0];
  const top = new Map();
  state.files.forEach((p) => {
    const parts = p.split("/");
    if (parts.length > 1) top.set(parts[0], true); else top.set(p, false);
  });
  const entries = [...top.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const rows = entries.map(([name, dir]) => {
    const c = lastCommit(commits, name, dir);
    return `<div class="gh-row" ${dir ? "" : `data-file="${esc(name)}"`} ${dir ? `data-dir="${esc(name)}"` : ""}>
      <span class="gh-name">${dir ? ico("folder", 15, "fi fi-dir") : fileIco(name)} <a>${esc(name)}</a></span>
      <span class="gh-msg muted">${c ? esc(c.message) : "loyiha yaratildi"}</span>
      <span class="gh-when muted">${c ? `kun ${c.day}` : ""}</span></div>`;
  }).join("");
  const clone = `git clone git@github.com:${owner}/${repo}.git`;
  const pushed = state.launch.done.github;
  const leaks = state.commits.filter((c) => c.file === ".env" && c.diff.some((l) => l.includes("SECRET_KEY")));
  return `
    <div class="gh-main">
      <div class="gh-toolbar">
        <span class="row"><button class="gh-btn">${ico("branch", 14)} <b>main</b> ${ico("chevronDown", 12)}</button>
          <span class="muted small">${ico("branch", 13)} <b>1</b> branch · ${ico("commit", 13)} <b>${commits.length}</b> kommit</span></span>
        <details class="gh-clone"><summary class="gh-btn green">${ico("code", 14)} Code ${ico("chevronDown", 12)}</summary>
          <div class="gh-clone-pop"><div class="small"><b>Clone</b> · SSH</div>
            <div class="gh-clone-url"><code>${esc(clone)}</code><button class="icon-btn" data-copy="${esc(clone)}" title="Nusxa olish">${ico("copy", 14)}</button></div>
            <p class="muted small">Boshqa kompyuterda (yoki serverda) shu buyruq loyihani to'liq ko'chirib oladi.</p></div></details>
      </div>
      ${leaks.length ? `<div class="gh-alert">${ico("shield", 16)} <div><b>Secret scanning:</b> tarixda <code>.env</code> → <code>SECRET_KEY</code> topildi
        (${leaks.length} kommit). Faylni o'chirish yetmaydi — Kod → .env da kalitni <b>rotate</b> qiling va .env ni .gitignore ga qo'shing.</div></div>` : ""}
      <div class="gh-box">
        <div class="gh-box-h gh-latest">${avatar()} <b>men</b> <span class="gh-msg">${latest ? esc(latest.message) : "—"}</span>
          <span class="muted small">${latest ? `<code>${esc(latest.sha)}</code> · kun ${latest.day}` : ""}</span>
          <button class="link" data-gtab="commits">${ico("history", 14)} ${commits.length} kommit</button></div>
        ${rows || `<div class="gh-row muted">Fayllar yo'q</div>`}
      </div>
      ${readmeHtml(state, data)}
    </div>
    <aside class="gh-side">
      <h4>About</h4>
      <p>${esc(state.room.name)} — Django sayti. Doskadagi tizim: ${state.blocks.filter((b) => b.kind !== "users").length} ta blok.</p>
      ${state.launch.domain ? `<p class="gh-link">${ico("globe", 14)} <b>${state.launch.done.ssl ? "https" : "http"}://${esc(state.launch.domain)}</b></p>` : ""}
      <div class="gh-topics">${["django", "python", ...new Set(state.blocks.map((b) => ({ postgres: "postgresql", nginx: "nginx", redis: "redis", worker: "celery", tgbot: "telegram-bot" }[b.kind])).filter(Boolean))]
        .map((t) => `<span>${t}</span>`).join("")}</div>
      <div class="gh-side-l">${ico(state.code.repo_public ? "eye" : "lock", 14)} ${state.code.repo_public ? "Ochiq — hamma ko'radi" : "Yopiq — faqat siz"}</div>
      <div class="gh-side-l">${ico("history", 14)} ${pushed ? "GitHub'da" : "Faqat kompyuteringizda"}</div>
      <h4>Languages</h4>${languages(state.files)}
    </aside>`;
}

function commitsTab(state) {
  const byDay = new Map();
  state.commits.forEach((c) => { if (!byDay.has(c.day)) byDay.set(c.day, []); byDay.get(c.day).push(c); });
  return `<div class="gh-main gh-full">
    <div class="gh-toolbar"><button class="gh-btn">${ico("branch", 14)} <b>main</b> ${ico("chevronDown", 12)}</button>
      <span class="muted small">Kommitni bosing — nima o'zgargani (diff) ochiladi</span></div>
    ${[...byDay.entries()].map(([day, list]) => `
      <div class="gh-day">${ico("commit", 15)} Kommitlar · kun ${day}</div>
      <div class="gh-box">${list.map((c) => {
        const { add, del } = counts(c.diff);
        const open = view.open === c.sha;
        return `<div class="gh-commit ${open ? "open" : ""}" data-sha="${esc(c.sha)}">
          <div class="gh-c-main"><b class="gh-c-msg">${esc(c.message)}</b>
            <span class="muted small">${avatar(16)} <b>men</b> kun ${c.day} da kommit qildi${c.file ? ` · ${esc(c.file)}` : ""}</span></div>
          <span class="gh-c-stat small">${c.diff.length ? `<span class="pos">+${add}</span> <span class="neg">−${del}</span>` : ""}</span>
          <code class="gh-sha">${esc(c.sha)}</code>
          <span class="gh-chev">${ico(open ? "chevronDown" : "chevronRight", 14)}</span>
        </div>${open ? diffHtml(c) : ""}`;
      }).join("")}</div>`).join("") || `<div class="gh-box gh-empty muted">Kommitlar yo'q</div>`}
  </div>`;
}

function emptyRepo(state, owner, repo) {
  const cmds = ["git init", "git add .", 'git commit -m "birinchi versiya"', "git branch -M main",
    `git remote add origin git@github.com:${owner}/${repo}.git`, "git push -u origin main"];
  const noCode = state.dev.scratch && !state.dev.finished;
  return `<div class="gh-main gh-full"><div class="gh-box gh-quick">
    <h3>${ico("rocket", 16)} Quick setup — repo hali bo'sh</h3>
    <p class="muted">${noCode ? "Avval kompyuteringizda loyiha yarating (chapdagi <b>Dars</b> bo'limi: oxirida <code>git push</code>), keyin kodni shu yerga yuklaysiz."
      : "Kod kompyuteringizda tayyor. Uni GitHub'ga yuklash uchun loyiha papkasida quyidagi buyruqlar bajariladi:"}</p>
    <pre class="term">${cmds.map(esc).join("\n")}</pre>
    <button class="btn primary" data-launch="${noCode ? "local" : "github"}">${ico(noCode ? "laptop" : "git", 14)} ${noCode ? "Darsni ochish" : "3-qadam: GitHub'ga yuklash"}</button>
  </div></div>`;
}

export function renderGit(state, data, ui, actions) {
  if (view.room !== state.room.id) { view.room = state.room.id; view.open = null; }
  const [owner, repo] = (state.launch.repo || state.ctx.repo).split("/");
  const empty = !state.commits.length;
  const leaks = state.commits.filter((c) => c.file === ".env" && c.diff.some((l) => l.includes("SECRET_KEY"))).length;
  const pub = !!state.code.repo_public;
  $("page-git").innerHTML = `
    <div class="gh card">
      <div class="gh-head">
        <div class="gh-title">${ico("book", 18)} <a>${esc(owner)}</a> / <a><b>${esc(repo)}</b></a>
          <span class="gh-badge">${pub ? "Public" : "Private"}</span>
          ${!state.launch.done.github && !empty ? `<span class="gh-badge warn" title="Kommitlar faqat kompyuteringizda">push qilinmagan</span>` : ""}</div>
        <div class="gh-acts"><button class="gh-btn">${ico("eye", 14)} Watch <span class="gh-cnt">1</span></button>
          <button class="gh-btn">${ico("fork", 14)} Fork <span class="gh-cnt">0</span></button>
          <button class="gh-btn">${ico("star", 14)} Star <span class="gh-cnt">${pub ? Math.min(99, Math.floor(state.room.users / 40)) : 0}</span></button></div>
      </div>
      <nav class="gh-tabs">
        <button data-gtab="code" class="${view.tab === "code" ? "on" : ""}">${ico("code", 15)} Code</button>
        <button data-gtab="commits" class="${view.tab === "commits" ? "on" : ""}">${ico("history", 15)} Commits <span class="gh-cnt">${state.commits.length}</span></button>
        <button data-gtab="security" class="${view.tab === "security" ? "on" : ""}">${ico("shield", 15)} Security ${leaks ? `<span class="gh-cnt red">${leaks}</span>` : ""}</button>
      </nav>
      <div class="gh-body">
        ${empty ? emptyRepo(state, owner, repo)
          : view.tab === "commits" ? commitsTab(state)
          : view.tab === "security" ? securityTab(state, leaks)
          : codeTab(state, data, owner, repo)}
      </div>
    </div>`;
  const page = $("page-git");
  page.querySelectorAll("[data-gtab]").forEach((el) => el.onclick = () => { view.tab = el.dataset.gtab; renderGit(state, data, ui, actions); });
  page.querySelectorAll("[data-sha]").forEach((el) => el.onclick = () => {
    view.open = view.open === el.dataset.sha ? null : el.dataset.sha; renderGit(state, data, ui, actions);
  });
  page.querySelectorAll("[data-file]").forEach((el) => el.onclick = () => actions.openFile(el.dataset.file));
  page.querySelectorAll("[data-dir]").forEach((el) => el.onclick = () => {
    const first = state.files.find((p) => p.startsWith(el.dataset.dir + "/"));
    if (first) actions.openFile(first);
  });
  page.querySelectorAll("[data-copy]").forEach((el) => el.onclick = (e) => {
    e.preventDefault();
    try { navigator.clipboard.writeText(el.dataset.copy); } catch { /* bo'sh */ }
    el.innerHTML = ico("check", 14);
  });
  page.querySelectorAll("[data-launch]").forEach((el) => el.onclick = () => actions.launchStep(el.dataset.launch));
}

function securityTab(state, leaks) {
  const items = [
    [state.code.env_gitignored, ".env fayli .gitignore da", "Kod → .gitignore → .env = ha"],
    [!leaks, "Tarixda sir yo'q", "Sir kommitga tushgan bo'lsa — rotate qiling (Kod → .env → ↻)"],
    [!state.code.repo_public || state.code.env_gitignored, "Ochiq repoda sir yo'q", "Repo ochiq bo'lsa, .env albatta .gitignore da bo'lsin"],
    [!state.code.debug, "DEBUG = False", "Kod → config/settings.py"],
  ];
  return `<div class="gh-main gh-full">
    ${leaks ? `<div class="gh-alert">${ico("shield", 16)} <div><b>${leaks} ta ochiq sir</b> — Git tarixi abadiy: faylni keyin o'chirish
      uni tarixdan yo'qotmaydi. Yagona to'g'ri javob — kalitni almashtirish (rotate).</div></div>` : ""}
    <div class="gh-box">${items.map(([ok, t, how]) => `<div class="gh-row">
      <span class="gh-name">${ico(ok ? "check" : "alert", 15, ok ? "pos" : "neg")} <b>${esc(t)}</b></span>
      <span class="gh-msg muted">${ok ? "joyida" : esc(how)}</span><span></span></div>`).join("")}</div>
  </div>`;
}
