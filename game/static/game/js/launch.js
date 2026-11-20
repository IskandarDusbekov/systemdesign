// =========================================================================
// launch.js — 🚀 "Saytni ishga tushirish" qatori (doska tepasida) va har bir
// qadam uchun oyna: nima, nega, buyruqlar, qilinmasa nima bo'ladi, amal.
//   (0 Lokal →) 1 Server → 2 Domen → 3 GitHub → 4 Deploy → 5 SSL (HTTPS)
// "0 · Lokal" faqat "Noldan" startupda: kompyuterda loyiha yaratish (local.js).
// =========================================================================
import { esc } from "./tpl.js";
import { ico } from "./ui-icons.js";
import { mountTerm } from "./term.js";

const $ = (id) => document.getElementById(id);
const STEP_ICO = { local: "laptop", server: "server", domain: "globe", github: "git", deploy: "download", ssl: "lock" };

export function renderLaunchBar(state, data, actions) {
  const st = state.launch, dev = state.dev;
  const steps = [...(dev.scratch ? [{ id: "local", n: 0, title: "Lokal" }] : []), ...data.catalog.launch];
  const done = { ...st.done, local: dev.finished };
  const next = steps.find((s) => !done[s.id]);
  const url = st.domain ? `${st.done.ssl ? "https" : "http"}://${st.domain}` : "domen yo'q";
  $("launchBar").innerHTML = `
    <span class="lb-title">${ico("rocket", 15)} Ishga tushirish</span>
    <span class="lb-steps">${steps.map((s, i) => `
      ${i ? `<span class="lb-arrow">${ico("chevronRight", 12)}</span>` : ""}
      <button class="lb-step ${done[s.id] ? "done" : ""} ${next && next.id === s.id ? "next" : ""}" data-step="${s.id}"
        title="${s.id === "local" ? `Kompyuterda loyiha yaratish · ${dev.done}/${dev.total}` : esc(s.title)}">
        <span class="lb-n">${done[s.id] ? ico("check", 11) : s.n}</span>${ico(STEP_ICO[s.id], 13)}${esc(s.title)}
        ${s.id === "local" && !dev.finished ? `<span class="lb-count">${dev.done}/${dev.total}</span>` : ""}
      </button>`).join("")}</span>
    <span class="lb-url ${st.done.ssl ? "secure" : st.domain ? "insecure" : ""}" title="Saytingiz manzili">
      ${ico(st.done.ssl ? "lock" : st.domain ? "unlock" : "globe", 13)} ${esc(url)}</span>
    ${st.pending_migration ? `<button class="lb-warn" data-step="deploy">${ico("alert", 13)} migratsiya qo'llanmagan</button>` : ""}
    ${state.suspended ? `<button class="lb-warn" data-resume>${ico("power", 13)} hosting to'xtagan — qayta yoqish</button>`
      : state.neglected ? `<button class="lb-warn" data-resume>${ico("pause", 13)} sayt to'xtagan (siz kirmadingiz) — yoqish</button>` : ""}`;
  $("launchBar").querySelectorAll("[data-resume]").forEach((el) => el.onclick = () => actions.resume());
  $("launchBar").querySelectorAll("[data-step]").forEach((el) => el.onclick = () => openStep(el.dataset.step, state, data, actions));
}

// Buyruqlardagi namunaviy qiymatlarni startupning haqiqiy qiymatlari bilan almashtiramiz
function realize(cmd, state) {
  const ctx = state.ctx;
  return cmd.replaceAll("myshop.uz", state.launch.domain || `${ctx.project}.uz`)
    .replaceAll("203.0.113.10", ctx.server_ip)
    .replaceAll("men/myshop", state.launch.repo || ctx.repo)
    .replaceAll("myshop", ctx.project);
}

// Terminal vazifalaridagi {ip}, {domain}... ni startupning haqiqiy qiymatlariga almashtiramiz
function vars(state) {
  const st = state.launch, ctx = state.ctx;
  const srv = state.blocks.find((b) => b.id === st.dns) || state.blocks.find((b) => b.kind === "server");
  const domain = st.domain || `${ctx.project}.uz`;
  return { ip: srv ? srv.ip : ctx.server_ip, host: srv ? srv.name : "server", domain, dns_ip: st.dns_ip || "(javob yo'q)",
    repo: st.repo || ctx.repo, project: ctx.project };
}

export function openStep(id, state, data, actions) {
  if (id === "local") { actions.tab("lesson"); return; }
  const s = data.catalog.launch.find((x) => x.id === id);
  const st = state.launch;
  const done = st.done[id];
  const v = vars(state);
  const servers = state.blocks.filter((b) => b.kind === "server");
  const entryHosts = new Set(state.blocks.filter((b) => ["nginx", "lb"].includes(b.kind) && b.host).map((b) => b.host));
  const noCode = state.dev.scratch && !state.dev.finished;

  // terminal holati: ochiqmi, oxirida amal bajariladimi
  let term = { enabled: true, reason: "", final: false, label: "" };
  let form = "";
  if (id === "server") {
    const boardTip = `<div class="tip info">${ico("server", 14)} <b>Doska = serverlaringiz.</b> Doskada turgan har <b>Server</b> bloki —
      data-markazdagi ijaraga olingan bitta kompyuter (IP manzili bilan). Nginx, Sayt, baza — uning <i>ichida</i> ishlaydigan dasturlar:
      blok qaysi serverda ekanini rangli yorliq ko'rsatadi. Server bo'lmasa, ularni o'rnatadigan joy yo'q.</div>`;
    form = boardTip + (servers.length
      ? `<div class="tip info">Serverlar: ${servers.map((x) => `<b>${esc(x.name)}</b> ${esc(x.ip)}`).join(" · ")}</div>`
      : `<div class="row"><button class="btn primary" data-web="bulutxon.uz">${ico("browser", 14)} Brauzerda: Bulutxon.uz → server ijarasi</button>
         <button class="btn" id="lsGo">${ico("server", 14)} Tez: O'rta server ($${data.catalog.servers.orta.rent}/kun)</button></div>
         <p class="muted small">Ijara shu paytdan boshlab har soat balansdan yechiladi.</p>`);
    term = { enabled: servers.length > 0, reason: "avval server oling (yuqoridagi tugma).", final: false, label: "Server tayyor." };
  } else if (id === "domain") {
    const def = st.domain || `${state.ctx.project}.uz`;
    form = `<div class="ls-form">
      <div class="tip info">${ico("browser", 14)} Real hayotdagidek: <b>brauzerda</b> domen do'koniga kirasiz, domen sotib olasiz,
        keyin DNS bo'limida <b>A yozuvi</b>ga server IP sini yozasiz.</div>
      <div class="row"><button class="btn primary" data-web="domenchi.uz">${ico("globe", 14)} Domenchi.uz — domen sotib olish</button>
        ${st.domain ? `<button class="btn" data-web="domenchi.uz/panel">${ico("edit", 14)} DNS: A yozuvi</button>` : ""}
        ${servers.length ? `<button class="btn ghost" data-web="bulutxon.uz/panel">${ico("copy", 14)} Server IP (Bulutxon)</button>` : ""}</div>
      ${st.domain ? `<div class="muted">Domen: <b>${esc(st.domain)}</b> → ${st.dns_ip ? `<code>${esc(st.dns_ip)}</code>` : `<span class="neg">A yozuvi yo'q</span>`}</div>` : ""}
      ${!servers.length ? `<div class="tip warn">Domen serverning IP siga qaraydi — avval 1-qadam: server oling.</div>` : ""}</div>`;
    term = { enabled: !!st.dns_ip, reason: "avval domen sotib oling va A yozuvini server IP siga yo'naltiring (brauzerda).", final: false, label: "DNS ishlayapti." };
  } else if (id === "github") {
    form = `<div class="ls-form">
      <label>Repo <input id="lsRepo" value="${esc(st.repo || state.ctx.repo)}" maxlength="70"></label>
      <label class="chk"><input type="checkbox" id="lsPublic" ${state.code.repo_public ? "checked" : ""}> ochiq (public) repo</label>
      ${!state.code.env_gitignored ? `<div class="tip warn">.env hali .gitignore da emas — push qilsangiz sirlar ham repoga tushadi. Avval Kod → .gitignore ni tuzating.</div>` : ""}</div>`;
    term = { enabled: !noCode, reason: "avval 0-qadam: kompyuteringizda loyiha yarating — yuklaydigan kod yo'q.", final: true, label: "Kod GitHubda." };
  } else if (id === "deploy") {
    form = st.pending_migration ? `<div class="tip bad">Yangi migratsiya bor, lekin serverda qo'llanmagan — qayta deploy qiling.</div>` : "";
    term = { enabled: st.done.github, reason: "avval 3-qadam: kodni GitHubga yuklang.", final: true, label: "Sayt serverda ishlayapti." };
  } else if (id === "ssl") {
    const ok = st.domain && entryHosts.has(st.dns);
    form = st.domain && !entryHosts.has(st.dns) ? `<div class="tip warn">Domen qaragan serverda Nginx/LB yo'q — certbot ishlamaydi.</div>` : "";
    term = { enabled: !!ok, reason: !st.domain ? "avval 2-qadam: domen." : "domen qaragan serverda Nginx yo'q.", final: !done, label: "HTTPS yoqildi." };
  }

  const payload = () => (id === "github" ? { repo: $("lsRepo").value, public: $("lsPublic").checked } : {});
  $("modalCard").innerHTML = `
    <div class="md-head">
      <h2>${ico(STEP_ICO[id], 20)} ${s.n}-qadam · ${esc(s.title)} ${done ? `<span class="verdict">${ico("check", 12)} bajarildi</span>` : ""}</h2>
      <button class="icon-btn" id="lsClose" title="Yopish">${ico("x", 16)}</button></div>
    <div class="ls-cols">
      <div class="ls-learn">
        <h3>Bu nima?</h3><p>${esc(s.what)}</p>
        <h3>Nega kerak?</h3><p>${esc(s.why)}</p>
        <div class="tip bad"><b>Qilinmasa:</b> ${esc(s.skip)}</div>
        ${s.warn ? `<div class="tip warn">${esc(s.warn)}</div>` : ""}
        <details class="ls-cmds"><summary>Barcha buyruqlar ro'yxati</summary>
          <pre class="term">${s.commands.map((c) => esc(realize(c, state))).join("\n")}</pre></details>
      </div>
      <div>
        ${form}
        <h3>${ico("terminal", 14)} Terminal — buyruqlarni o'zingiz yozing</h3>
        <div id="lsTerm"></div>
        <div class="muted small tty-note">${term.final ? "Oxirgi buyruqdan keyin qadam bajariladi." : "Mashq: real serverda xuddi shunday tekshiriladi."}</div>
      </div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("modalCard").className = "modal-card card wide";
  $("lsClose").onclick = actions.closeModal;
  mountTerm($("lsTerm"), {
    tasks: s.terminal || [], vars: v, ps: `men@noutbuk:~/${v.project}$`, os: "linux",
    sshPassword: (ip) => state.blocks.find((b) => b.kind === "server" && b.ip === ip)?.password || "",
    title: id === "github" ? `~/${v.project} — git` : `ssh · ${v.host}`,
    enabled: term.enabled, reason: term.reason, finalLabel: term.label, demoKey: "vallum.ttydemo",
    listing: () => state.files.filter((p) => !p.includes("/")).concat([...new Set(state.files.filter((p) => p.includes("/")).map((p) => p.split("/")[0] + "/"))]).join("  "),
    onDone: term.final ? () => actions.launch(id, payload()) : null,
  });
  $("modalCard").querySelectorAll("[data-web]").forEach((b) => b.onclick = () => actions.openWeb(b.dataset.web));
  const go = $("lsGo");
  if (!go) return;
  go.onclick = () => {
    if (id === "server") { actions.closeModal(); actions.add("server"); return; }
    actions.launch(id, { name: $("lsName").value, server: Number($("lsServer").value) }, true);
  };
}
