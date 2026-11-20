// =========================================================================
// launch.js — 🚀 "Saytni ishga tushirish" qatori (doska tepasida) va har bir
// qadam uchun oyna: nima, nega, buyruqlar, qilinmasa nima bo'ladi, amal.
//   1 Server → 2 Domen → 3 GitHub → 4 Deploy → 5 SSL (HTTPS)
// =========================================================================
import { esc } from "./tpl.js";

const $ = (id) => document.getElementById(id);

export function renderLaunchBar(state, data, actions) {
  const st = state.launch;
  const steps = data.catalog.launch;
  // Keyingi qilinadigan qadam — ajratib ko'rsatiladi
  const next = steps.find((s) => !st.done[s.id]);
  const url = st.domain ? `${st.done.ssl ? "https" : "http"}://${st.domain}` : "domen yo'q";
  $("launchBar").innerHTML = `
    <span class="lb-title">🚀 Ishga tushirish</span>
    ${steps.map((s, i) => `
      ${i ? `<span class="lb-arrow">→</span>` : ""}
      <button class="lb-step ${st.done[s.id] ? "done" : ""} ${next && next.id === s.id ? "next" : ""}" data-step="${s.id}">
        <span class="lb-n">${st.done[s.id] ? "✓" : s.n}</span>${esc(s.title)}
      </button>`).join("")}
    <span class="lb-url ${st.done.ssl ? "secure" : st.domain ? "insecure" : ""}" title="Saytingiz manzili">
      ${st.done.ssl ? "🔒" : st.domain ? "⚠" : "○"} ${esc(url)}</span>
    ${st.pending_migration ? `<button class="lb-warn" data-step="deploy">⚠ migratsiya qo'llanmagan</button>` : ""}
    ${state.suspended ? `<button class="lb-warn" data-resume>⛔ hosting to'xtagan — qayta yoqish</button>`
      : state.neglected ? `<button class="lb-warn" data-resume>⏸ sayt to'xtagan (siz kirmadingiz) — yoqish</button>` : ""}`;
  $("launchBar").querySelectorAll("[data-resume]").forEach((el) => el.onclick = () => actions.resume());
  $("launchBar").querySelectorAll("[data-step]").forEach((el) => el.onclick = () => openStep(el.dataset.step, state, data, actions));
}

// Buyruqlardagi namunaviy qiymatlarni xonaning haqiqiy qiymatlari bilan almashtiramiz
function realize(cmd, state) {
  const ctx = state.ctx;
  return cmd.replaceAll("myshop.uz", state.launch.domain || `${ctx.project}.uz`)
    .replaceAll("203.0.113.10", ctx.server_ip)
    .replaceAll("men/myshop", state.launch.repo || ctx.repo)
    .replaceAll("myshop", ctx.project);
}

// Terminal vazifalaridagi {ip}, {domain}... ni xonaning haqiqiy qiymatlariga almashtiramiz
function vars(state) {
  const st = state.launch, ctx = state.ctx;
  const srv = state.blocks.find((b) => b.id === st.dns) || state.blocks.find((b) => b.kind === "server");
  const domain = st.domain || `${ctx.project}.uz`;
  return { ip: srv ? srv.ip : ctx.server_ip, host: srv ? srv.name : "server", domain, dns_ip: st.dns_ip || "(javob yo'q)",
    repo: st.repo || ctx.repo, project: ctx.project };
}
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (c) => c.trim().replace(/\s+/g, " ").replace(/^sudo /, "").replace(/;$/, "").replace(/'/g, '"');

// --- Kichik terminal: o'yinchi buyruqni o'zi yozadi -----------------------
//   tasks — launch.STEPS[...].terminal; onDone — oxirgi buyruqdan keyin (amal)
function mountTerminal(tasks, v, { enabled, reason, onDone, finalLabel }) {
  const out = $("ttyOut"), inp = $("ttyIn"), ps = $("ttyPs"), task = $("ttyTask");
  let i = 0, fails = 0, typing = false;
  const print = (text, cls = "") => {
    out.insertAdjacentHTML("beforeend", `<div class="tty-l ${cls}">${esc(text)}</div>`);
    out.scrollTop = out.scrollHeight;
  };
  const showTask = () => {
    task.innerHTML = i < tasks.length
      ? `<b>Vazifa ${i + 1}/${tasks.length}:</b> ${esc(fill(tasks[i].ask, v))}`
      : `<b>✓ Hammasi bajarildi.</b> ${esc(finalLabel || "")}`;
    $("ttyBar").style.width = `${(i / tasks.length) * 100}%`;
  };
  ps.textContent = `men@noutbuk:~/${v.project}$`;
  if (!enabled) {
    inp.disabled = true;
    task.innerHTML = `<b>Terminal yopiq:</b> ${esc(reason)}`;
    return;
  }
  showTask();
  print("# buyruqni yozing va Enter bosing. Bilmasangiz — 💡 tugmasi", "muted");
  $("ttyHint").onclick = () => {
    if (i >= tasks.length) return;
    inp.value = fill(tasks[i].cmd, v);
    inp.focus();
  };
  // ▶ tizim buyruqni harfma-harf yozib, o'zi Enter bosadi
  const typeDemo = async () => {
    if (i >= tasks.length || typing) return;
    typing = true;
    const cmd = fill(tasks[i].cmd, v);
    inp.value = "";
    inp.classList.add("typing");
    for (const ch of cmd) { inp.value += ch; await sleep(cmd.length > 40 ? 28 : 55); }
    await sleep(400);
    inp.classList.remove("typing");
    typing = false;
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  };
  $("ttyDemo").onclick = typeDemo;
  inp.focus();
  let first = false;
  try { first = localStorage.getItem("vallum.ttydemo") !== "1"; localStorage.setItem("vallum.ttydemo", "1"); } catch { /* bo'sh */ }
  if (first) {
    print("# Birinchi marta: tizim 1-buyruqni o'zi yozib ko'rsatadi. Keyingilarini o'zingiz yozing (▶ tugmasi doim yordam beradi).", "hint");
    setTimeout(typeDemo, 900);
  }
  inp.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || i >= tasks.length) return;
    const raw = inp.value;
    inp.value = "";
    if (!raw.trim() || typing) return;
    print(`${ps.textContent} ${raw}`, "cmd");
    const t = tasks[i], c = norm(raw);
    const ok = [t.cmd, ...(t.alt || [])].some((x) => norm(fill(x, v)) === c)
      || (t.prefix && c.startsWith(norm(fill(t.prefix, v))));
    if (c === "clear") { out.innerHTML = ""; return; }
    // zararsiz yordamchi buyruqlar — vazifaga ta'sir qilmaydi
    const builtins = {
      ls: "README.md  config  manage.py  requirements.txt  app  accounts  templates  static  media  deploy", pwd: ps.textContent.includes("/srv/") ? `/srv/${v.project}` : "/root",
      whoami: ps.textContent.startsWith("root") ? "root" : "men", help: `vazifa: ${fill(t.ask, v)} · 💡 tugmasi buyruqni ko'rsatadi`,
    };
    if (!ok && builtins[c]) { print(builtins[c], "muted"); return; }
    if (!ok) {
      fails += 1;
      const word = c.split(" ")[0];
      const known = ["ssh", "apt", "git", "dig", "curl", "pip", "python", "python3", "systemctl", "certbot", "cd", "nslookup", "host"];
      print(known.includes(word) ? `${word}: bu buyruq hozirgi vazifaga mos emas` : `bash: ${word}: command not found`, "err");
      if (fails >= 2) print(`💡 Kerakli buyruq: ${fill(t.cmd, v)}`, "hint");
      return;
    }
    fails = 0;
    (t.out || []).forEach((l) => print(fill(l, v)));
    if (t.ps) ps.textContent = fill(t.ps, v);
    i += 1;
    showTask();
    if (i >= tasks.length && onDone) {
      inp.disabled = true;
      print("…", "muted");
      const res = await onDone();
      print(res ? "✓ bajarildi" : "✗ bajarilmadi — sababi pastdagi xabarda", res ? "ok" : "err");
      if (!res) { inp.disabled = false; i = tasks.length - 1; showTask(); }
    }
  });
}

export function openStep(id, state, data, actions) {
  const s = data.catalog.launch.find((x) => x.id === id);
  const st = state.launch;
  const done = st.done[id];
  const v = vars(state);
  const servers = state.blocks.filter((b) => b.kind === "server");
  const entryHosts = new Set(state.blocks.filter((b) => ["nginx", "lb"].includes(b.kind) && b.host).map((b) => b.host));

  // terminal holati: ochiqmi, oxirida amal bajariladimi
  let term = { enabled: true, reason: "", final: false, label: "" };
  let form = "";
  if (id === "server") {
    form = servers.length
      ? `<div class="tip info">Serverlar: ${servers.map((x) => `<b>${esc(x.name)}</b> ${esc(x.ip)}`).join(" · ")}</div>`
      : `<button class="btn primary" id="lsGo">▣ Server qo'shish ($${data.catalog.servers.orta.rent}/kun)</button>`;
    term = { enabled: servers.length > 0, reason: "avval server qo'shing (yuqoridagi tugma).", final: false, label: "Server tayyor." };
  } else if (id === "domain") {
    const def = st.domain || `${state.ctx.project}.uz`;
    form = `<div class="ls-form">
      <label>Domen nomi <input id="lsName" value="${esc(def)}" maxlength="40"></label>
      <label>A yozuvi → server
        <select id="lsServer">${servers.map((x) => `<option value="${x.id}" ${x.id === st.dns ? "selected" : ""}>
          ${esc(x.name)} · ${esc(x.ip)}${x.config.public ? "" : " (ichki!)"}${entryHosts.has(x.id) ? " · Nginx bor" : ""}</option>`).join("")}</select></label>
      <div class="muted">Yangi domen: $${data.catalog.domain_cost} / yil · zonalar: .${data.catalog.domain_zones.join(", .")}</div>
      <button class="btn primary" id="lsGo">${st.domain ? "Saqlash" : "Sotib olish va yo'naltirish"}</button></div>`;
    term = { enabled: !!st.domain, reason: "avval domenni sotib oling (yuqoridagi tugma), keyin DNS ni tekshirasiz.", final: false, label: "DNS ishlayapti." };
  } else if (id === "github") {
    form = `<div class="ls-form">
      <label>Repo <input id="lsRepo" value="${esc(st.repo || state.ctx.repo)}" maxlength="70"></label>
      <label class="chk"><input type="checkbox" id="lsPublic" ${state.code.repo_public ? "checked" : ""}> ochiq (public) repo</label>
      ${!state.code.env_gitignored ? `<div class="tip warn">.env hali .gitignore da emas — push qilsangiz sirlar ham repoga tushadi. Avval Kod → .gitignore ni tuzating.</div>` : ""}</div>`;
    term = { enabled: true, final: true, label: "Kod GitHubda." };
  } else if (id === "deploy") {
    form = st.pending_migration ? `<div class="tip bad">Yangi migratsiya bor, lekin serverda qo'llanmagan — qayta deploy qiling.</div>` : "";
    term = { enabled: st.done.github, reason: "avval 3-qadam: kodni GitHubga yuklang.", final: true, label: "Sayt serverda ishlayapti." };
  } else if (id === "ssl") {
    const ok = st.domain && entryHosts.has(st.dns);
    form = st.domain && !entryHosts.has(st.dns) ? `<div class="tip warn">Domen qaragan serverda Nginx/LB yo'q — certbot ishlamaydi.</div>` : "";
    term = { enabled: !!ok, reason: !st.domain ? "avval 2-qadam: domen." : "domen qaragan serverda Nginx yo'q.", final: !done, label: "HTTPS yoqildi 🔒" };
  }

  const payload = () => (id === "github" ? { repo: $("lsRepo").value, public: $("lsPublic").checked } : {});
  $("modalCard").innerHTML = `
    <div class="row" style="justify-content:space-between">
      <h2 style="margin:0">${s.icon} ${s.n}-qadam · ${esc(s.title)} ${done ? `<span class="verdict">bajarildi</span>` : ""}</h2>
      <button class="btn small ghost" id="lsClose">✕</button></div>
    <div class="ls-cols">
      <div>
        <h3>Bu nima?</h3><p>${esc(s.what)}</p>
        <h3>Nega kerak?</h3><p>${esc(s.why)}</p>
        <div class="tip bad"><b>Qilinmasa:</b> ${esc(s.skip)}</div>
        ${s.warn ? `<div class="tip warn">${esc(s.warn)}</div>` : ""}
        <details class="ls-cmds"><summary>Barcha buyruqlar ro'yxati</summary>
          <pre class="term">${s.commands.map((c) => esc(realize(c, state))).join("\n")}</pre></details>
      </div>
      <div>
        ${form}
        <h3>💻 Terminal — buyruqlarni o'zingiz yozing</h3>
        <div class="tty">
          <div class="tty-task" id="ttyTask"></div><div class="tty-prog"><i id="ttyBar"></i></div>
          <div class="tty-out" id="ttyOut"></div>
          <div class="tty-line"><span class="tty-ps" id="ttyPs"></span><input id="ttyIn" autocomplete="off" spellcheck="false"></div>
        </div>
        <div class="row tty-actions"><span class="row"><button class="btn small" id="ttyDemo">▶ Yozib ko'rsat</button>
          <button class="link" id="ttyHint">💡 buyruqni qo'yish</button></span>
          <span class="muted small">${term.final ? "Oxirgi buyruqdan keyin qadam bajariladi" : "Mashq: real serverda shunday tekshiriladi"}</span></div>
      </div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("lsClose").onclick = actions.closeModal;
  mountTerminal(s.terminal || [], v, {
    enabled: term.enabled, reason: term.reason, finalLabel: term.label,
    onDone: term.final ? () => actions.launch(id, payload()) : null,
  });
  const go = $("lsGo");
  if (!go) return;
  go.onclick = () => {
    if (id === "server") { actions.closeModal(); actions.add("server"); return; }
    actions.launch(id, { name: $("lsName").value, server: Number($("lsServer").value) }, true);
  };
}
