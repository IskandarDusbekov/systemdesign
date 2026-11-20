// =========================================================================
// term.js — o'quv terminali (🚀 qadamlar va 🎓 Dars uchun umumiy).
//   * o'yinchi buyruqni o'zi yozadi; to'g'ri bo'lsa — natija sekin chiqadi va
//     "Nima bo'ldi" izohi ko'rinadi. "Tushundim → keyingi" bosilmaguncha keyingi
//     vazifaga o'tilmaydi (shoshilmasdan tushunib borish uchun);
//   * ↑ / ↓ — tarix, Tab — to'ldirish, help, clear / cls;
//   * ▶ Yozib ko'rsat — tizim harfma-harf yozib, Enter bosadi; Buyruq — qatorga qo'yadi;
//   * "edit" turidagi vazifa (faylga kod yozish) terminalda emas — muharrirda bajariladi,
//     tashqaridan `complete(task)` chaqiriladi;
//   * oyna ko'rinishi: Windows (cmd) yoki Linux (ssh) — `os` bilan.
// =========================================================================
import { esc } from "./tpl.js";
import { ico } from "./ui-icons.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const norm = (c) => c.trim().replace(/\s+/g, " ").replace(/^sudo /, "").replace(/;$/, "").replace(/'/g, '"')
  .replace(/\\/g, "/").toLowerCase();

// Har qanday terminalda ishlaydigan zararsiz buyruqlar
function builtin(c, ctx) {
  const word = c.split(" ")[0];
  if (["ls", "dir"].includes(word)) return ctx.listing() || "(bo'sh)";
  if (["pwd", "cd"].includes(c)) return ctx.cwd();
  if (word === "whoami") return ctx.user;
  if (word === "echo") return c.slice(5);
  if (["python --version", "py --version", "python -v"].includes(c)) return "Python 3.12.4";
  if (["git --version"].includes(c)) return "git version 2.45.1";
  if (c === "git status") return "On branch main\nnothing to commit, working tree clean";
  return null;
}

/**
 * mountTerm(root, opts) — root ichiga terminal chizadi.
 * opts: tasks, vars, ps (boshlang'ich prompt), os ("win" | "linux"), title, start (nechta bajarilgan),
 *       enabled, reason, finalLabel, onTask(i, task) → Promise<bool>, onDone() → Promise<bool>,
 *       onAdvance(i) — "Tushundim" bosilib keyingi vazifaga o'tilganda,
 *       changes(task) → ["+ fayl", "~ fayl"] — izohda "nima o'zgardi",
 *       gate (default true) — izohdan keyin "Tushundim" kutish,
 *       listing() → "ls" javobi, demoKey (localStorage: birinchi marta avto-ko'rsatish)
 */
export function mountTerm(root, opts) {
  const v = opts.vars || {};
  const tasks = opts.tasks || [];
  const win = opts.os === "win";
  const gate = opts.gate !== false;
  const pace = opts.fast ? 0.3 : 1;          // tez rejim: natija tezroq chiqadi
  const log = (kind, cmd, text) => { if (opts.onLog) opts.onLog(kind, cmd, text); };
  let i = Math.min(opts.start || 0, tasks.length), fails = 0, typing = false, busy = false, waiting = false;
  const hist = [];
  let hpos = -1;

  root.innerHTML = `
    <div class="tm ${win ? "tm-win" : "tm-linux"}">
      <div class="tm-bar">
        <span class="tm-dots"><i></i><i></i><i></i></span>
        <span class="tm-title">${ico("terminal", 13)} ${esc(opts.title || (win ? "Command Prompt" : "bash"))}</span>
        <span class="tm-tools">
          <button class="tm-btn" data-t="demo" title="Tizim buyruqni o'zi sekin yozib ko'rsatadi">${ico("play", 12)} Yozib ko'rsat</button>
          <button class="tm-btn" data-t="hint" title="Kerakli buyruqni qatorga qo'yadi">${ico("bulb", 12)} Buyruq</button>
        </span>
      </div>
      <div class="tm-task"><span class="tm-step"></span><span class="tm-ask"></span></div>
      <div class="tm-prog"><i></i></div>
      <div class="tm-out"></div>
      <label class="tm-line"><span class="tm-ps"></span><input class="tm-in" autocomplete="off" spellcheck="false" aria-label="Buyruq"></label>
      <div class="tm-keys"><kbd>Enter</kbd> bajarish <kbd>Tab</kbd> to'ldirish <kbd>↑</kbd><kbd>↓</kbd> tarix <kbd>help</kbd> yordam <kbd>${win ? "cls" : "clear"}</kbd> tozalash</div>
    </div>
    <div class="tm-explain hidden"></div>`;

  const q = (s) => root.querySelector(s);
  const out = q(".tm-out"), inp = q(".tm-in"), psEl = q(".tm-ps"), explainEl = q(".tm-explain");
  let ps = opts.ps || "$";
  const setPs = (p) => { ps = p; psEl.textContent = p; };
  setPs(ps);
  const isEdit = () => i < tasks.length && tasks[i].kind === "edit";

  const print = (text, cls = "") => {
    out.insertAdjacentHTML("beforeend", `<div class="tm-l ${cls}">${esc(text)}</div>`);
    out.scrollTop = out.scrollHeight;
  };
  const lockInput = (on) => {
    inp.disabled = on;
    root.querySelectorAll(".tm-btn").forEach((b) => { b.disabled = on; });
  };
  const showTask = () => {
    const step = q(".tm-step"), ask = q(".tm-ask");
    if (i < tasks.length) {
      step.textContent = `${i + 1}/${tasks.length}`;
      ask.textContent = (isEdit() ? "Muharrirda: " : "") + fill(tasks[i].ask, v);
    } else {
      step.innerHTML = ico("check", 13);
      ask.textContent = `Hammasi bajarildi. ${opts.finalLabel || ""}`;
    }
    q(".tm-task").classList.toggle("done", i >= tasks.length);
    q(".tm-task").classList.toggle("edit", isEdit());
    q(".tm-prog i").style.width = `${(i / Math.max(1, tasks.length)) * 100}%`;
    lockInput(isEdit() || waiting);
    if (isEdit()) print("# Bu qadam terminalda emas — yuqoridagi muharrirda faylga kod yozing.", "hint");
  };

  // "Nima bo'ldi" + "Tushundim" — bosilmaguncha keyingi vazifa ochilmaydi
  const explain = (t) => new Promise((resolve) => {
    if (!t.explain) { explainEl.classList.add("hidden"); resolve(); return; }
    const ch = opts.changes ? opts.changes(t) : [];
    const next = i + 1 < tasks.length ? fill(tasks[i + 1].ask, v) : "";
    const what = t.kind === "edit" ? `<code>${esc(t.file)}</code> saqlandi` : `<code>${esc(fill(t.cmd, v))}</code>`;
    explainEl.classList.remove("hidden");
    explainEl.innerHTML = `<div class="tm-ex-h">${ico("info", 15)} Nima bo'ldi: ${what}</div>
      <p>${esc(fill(t.explain, v))}</p>
      ${t.why ? `<p class="tm-why">${ico("bulb", 13)} ${esc(fill(t.why, v))}</p>` : ""}
      ${ch.length ? `<div class="tm-ch"><span>O'zgardi:</span>${ch.map((c) => `<em class="${c[0] === "+" ? "add" : "mod"}">${esc(c)}</em>`).join("")}</div>` : ""}
      ${gate ? `<div class="tm-gate"><button class="btn primary small tm-ok">${ico("check", 13)} Tushundim${next ? " — keyingi qadam" : ""} ${ico("arrowRight", 13)}</button>
        ${next ? `<span class="muted small">Keyingisi: ${esc(next)}</span>` : ""}</div>` : ""}`;
    explainEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!gate) { resolve(); return; }
    // vazifa qatorida ham ko'rinsin: "pastdagi izohni o'qing → Tushundim"
    const bar = q(".tm-task");
    bar.classList.add("wait");
    q(".tm-step").innerHTML = ico("info", 13);
    q(".tm-ask").innerHTML = `Bajarildi! Pastdagi izohni o'qing ${ico("arrowRight", 12)} <button class="tm-ok2">${ico("check", 12)} Tushundim</button>`;
    const btn = explainEl.querySelector(".tm-ok");
    btn.focus({ preventScroll: true });
    const done = () => {
      btn.disabled = true;
      bar.classList.remove("wait");
      explainEl.classList.add("hidden");        // izoh yopiladi — kerak bo'lsa qadamni qayta ko'rish mumkin
      resolve();
    };
    btn.onclick = done;
    q(".tm-ok2").onclick = done;
  });

  root.addEventListener("click", (e) => { if (!e.target.closest("button") && !inp.disabled) inp.focus(); });

  if (!opts.enabled) {
    lockInput(true);
    q(".tm-step").innerHTML = ico("lock", 13);
    q(".tm-ask").textContent = `Terminal yopiq: ${opts.reason || ""}`;
    return { typeDemo() {}, complete: async () => false };
  }
  if (i === 0) print(win ? "Microsoft Windows [Version 10.0.19045]\n(c) Microsoft Corporation. All rights reserved." : "# buyruqni yozing va Enter bosing", "muted");
  else print(`# ${i} ta vazifa avval bajarilgan — davom etamiz`, "muted");
  print("# Bilmasangiz: ▶ Yozib ko'rsat yoki Buyruq tugmasi. 'help' — yordam.", "muted");
  if (opts.freeName && i === 0) print("# Tez rejim: papkani istalgan nom bilan yarating, masalan: mkdir mening_dokonim — keyingi buyruqlar shu nom bilan davom etadi.", "hint");
  showTask();

  const hint = () => { if (!pwAsk && i < tasks.length && !isEdit()) { inp.value = fill(tasks[i].cmd, v); inp.focus(); } };
  const typeDemo = async () => {
    if (pwAsk || i >= tasks.length || typing || busy || waiting || isEdit()) return;
    typing = true;
    const cmd = fill(tasks[i].cmd, v);
    inp.value = "";
    inp.classList.add("typing");
    for (const ch of cmd) { inp.value += ch; await sleep(cmd.length > 40 ? 45 : 85); }
    await sleep(700);
    inp.classList.remove("typing");
    typing = false;
    submit();
  };
  q('[data-t="demo"]').onclick = typeDemo;
  q('[data-t="hint"]').onclick = hint;

  // Vazifa bajarildi: natija sekin chiqadi → izoh → "Tushundim" → keyingi vazifa
  async function finish(t) {
    busy = true;
    if (t.kind !== "edit") {
      const outs = t.out || [];
      if (outs.length > 2) { print("…", "muted"); await sleep(500 * pace); }
      for (const l of outs) { print(fill(l, v), l.startsWith("#") || l.startsWith("^C") ? "muted" : ""); await sleep((l.length > 50 ? 260 : 180) * pace); }
      if (!outs.length) print(win ? "" : "", "muted");
      if (t.ps) setPs(fill(t.ps, v));
    } else {
      print(`# ${t.file} saqlandi (Ctrl+S)`, "ok");
    }
    log("ok", t.kind === "edit" ? `${t.file} saqlandi` : fill(t.cmd, v), fill(t.explain || "", v));
    waiting = gate;
    lockInput(true);
    await explain(t);
    waiting = false;
    i += 1;
    showTask();
    busy = false;
    if (opts.onAdvance) opts.onAdvance(i);
    if (i >= tasks.length && opts.onDone) {
      lockInput(true);
      print("…", "muted");
      const res = await opts.onDone();
      print(res ? "✓ bajarildi" : "✗ bajarilmadi — sababi xabarda", res ? "ok" : "err");
      if (!res) { i = tasks.length - 1; showTask(); }
    }
    if (!inp.disabled) inp.focus();
  }

  // ssh parol rejimi: resolve(true) — to'g'ri parol
  let pwAsk = null;
  const askPassword = (host) => new Promise((resolve) => {
    pwAsk = { resolve, tries: 0, host };
    print(`root@${host}'s password:`, "muted");
    inp.type = "password";
    inp.placeholder = "parolni yozing (ko'rinmaydi) — Bulutxon → Serverlarim";
    lockInput(false);
    inp.focus();
  });
  function checkPassword(raw) {
    const p = pwAsk, ok = raw === opts.sshPassword(p.host);
    if (ok) {
      inp.type = "text"; inp.placeholder = "";
      pwAsk = null;
      log("ok", `root@${p.host} paroli`, "Parol to'g'ri — serverga kirdingiz");
      p.resolve(true);
      return;
    }
    p.tries += 1;
    print("Permission denied, please try again.", "err");
    log("err", `root@${p.host} paroli`, "Parol noto'g'ri. Uni Brauzer → bulutxon.uz → Serverlarim dan oling (ko'z belgisi yoki nusxalash)");
    if (p.tries >= 3) {
      print(`root@${p.host}: Permission denied (publickey,password).`, "err");
      print("💡 Parol: Brauzer → bulutxon.uz → Serverlarim → parol (nusxalang, keyin shu yerda Ctrl+V)", "hint");
      inp.type = "text"; inp.placeholder = "";
      pwAsk = null;
      p.resolve(false);
      return;
    }
    print(`root@${p.host}'s password:`, "muted");
  }

  async function submit() {
    if (pwAsk) { const r = inp.value; inp.value = ""; checkPassword(r); return; }
    if (busy || waiting) return;   // oldingi buyruq hali chiqyapti — yozilgan matn yo'qolmasin
    const raw = inp.value;
    inp.value = "";
    if (!raw.trim()) return;
    hist.push(raw); hpos = hist.length;
    print(`${ps} ${raw}`, "cmd");
    const c = norm(raw);
    if (c === "clear" || c === "cls") { out.innerHTML = ""; return; }
    if (c === "help") {
      print(i < tasks.length ? `Hozirgi vazifa: ${fill(tasks[i].ask, v)}` : "Hamma vazifa bajarilgan.", "hint");
      print("Tab — buyruqni to'ldiradi · ↑ — oldingi buyruq · ▶ — tizim yozib ko'rsatadi", "muted");
      return;
    }
    if (i >= tasks.length || isEdit()) {
      const b = builtin(c, ctx());
      print(b !== null ? b : "# hozir terminal vazifasi yo'q", "muted");
      return;
    }
    const t = tasks[i];
    // Erkin nom (tez rejim): birinchi papkani istalgan nom bilan yaratish — keyingi buyruqlar shu nom bilan
    if (opts.freeName && t.id === "mkdir") {
      const m = raw.trim().match(/^(mkdir|md)\s+([A-Za-z][A-Za-z0-9_-]{0,39})$/i);
      if (m) {
        v.project = m[2];
        if (opts.onName) opts.onName(m[2]);
      } else if (/^(mkdir|md)\b/i.test(raw.trim())) {
        print("Nom: lotin harf bilan boshlansin, faqat harf, raqam, - va _ (bo'sh joysiz). Masalan: mkdir mening_dokonim", "err");
        log("err", raw, "Papka nomi noto'g'ri: lotin harf bilan boshlansin, bo'sh joysiz (masalan mening_dokonim)");
        return;
      }
    }
    const ok = [t.cmd, ...(t.alt || [])].some((x) => norm(fill(x, v)) === c)
      || (t.prefix && c.startsWith(norm(fill(t.prefix, v))) && c.length > norm(t.prefix).length + 2);
    if (!ok) {
      const b = builtin(c, ctx());
      if (b !== null) { print(b, "muted"); log("info", raw, b.split("\n")[0] || "bajarildi"); return; }
      fails += 1;
      const word = c.split(" ")[0];
      const expected = norm(fill(t.cmd, v)).split(" ")[0];
      if (word === expected) print(`${word}: buyruq to'g'ri, lekin davomi boshqacha bo'lishi kerak`, "err");
      else print(win ? `'${word}' is not recognized as an internal or external command,\noperable program or batch file.` : `bash: ${word}: command not found`, "err");
      log("err", raw, word === expected ? `Buyruq to'g'ri, lekin davomi boshqacha. Kerak edi: ${fill(t.cmd, v)}`
        : `"${word}" — bunday buyruq yo'q yoki bu qadamga mos emas. Kerak edi: ${fill(t.cmd, v)}`);
      if (fails >= 2) print(`💡 Kerakli buyruq: ${fill(t.cmd, v)}   (Tab bosing — o'zi to'ldiradi)`, "hint");
      return;
    }
    fails = 0;
    busy = true;
    const sshTo = c.match(/^ssh\s+root@([\d.]+)$/);
    if (sshTo && opts.sshPassword && opts.sshPassword(sshTo[1])) {
      busy = false;
      const okPw = await askPassword(sshTo[1]);
      if (!okPw) return;
      busy = true;
    }
    if (opts.onTask) {
      const res = await opts.onTask(i, t);
      if (!res) { busy = false; print("✗ bajarilmadi — sababi xabarda", "err"); log("err", raw, "Bajarilmadi — sababi xabarda"); return; }
    }
    await finish(t);
  }

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (!typing) submit(); }
    else if (e.key === "ArrowUp") { if (hist.length) { hpos = Math.max(0, hpos - 1); inp.value = hist[hpos]; } e.preventDefault(); }
    else if (e.key === "ArrowDown") { hpos = Math.min(hist.length, hpos + 1); inp.value = hist[hpos] || ""; e.preventDefault(); }
    else if (e.key === "Tab") {
      if (pwAsk) { e.preventDefault(); return; }
      e.preventDefault();
      if (i >= tasks.length || isEdit()) return;
      const cmd = fill(tasks[i].cmd, v);
      if (!inp.value.trim() || norm(cmd).startsWith(norm(inp.value))) inp.value = cmd;
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
  });

  function ctx() {
    return { user: ps.startsWith("root") ? "root" : "men", cwd: () => (opts.cwd ? opts.cwd() : ps.replace(/[>#$]\s*$/, "").replace(/^\(venv\) /, "")),
      listing: () => (opts.listing ? opts.listing() : "") };
  }

  // birinchi marta — tizim 1-buyruqni o'zi yozib ko'rsatadi
  let first = false;
  if (opts.demoKey) {
    try { first = localStorage.getItem(opts.demoKey) !== "1"; localStorage.setItem(opts.demoKey, "1"); } catch { /* bo'sh */ }
  }
  if (first && i < tasks.length && !isEdit()) {
    print("# Birinchi marta: tizim 1-buyruqni o'zi sekin yozadi. Keyingilarini o'zingiz yozing.", "hint");
    setTimeout(typeDemo, 1200);
  }
  setTimeout(() => { if (!inp.disabled) inp.focus({ preventScroll: true }); }, 50);

  return {
    typeDemo,
    get index() { return i; },
    // muharrirdagi (edit) vazifa bajarildi — terminal izoh va "Tushundim" ni ko'rsatadi
    async complete(t) {
      if (busy || waiting || tasks[i] !== t) return false;
      if (opts.onTask) {
        busy = true;
        const res = await opts.onTask(i, t);
        busy = false;
        if (!res) return false;
      }
      await finish(t);
      return true;
    },
  };
}
