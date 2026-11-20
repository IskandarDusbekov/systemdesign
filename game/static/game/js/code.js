// =========================================================================
// code.js — "Kod" sahifasi, PyCharm / VS Code ga o'xshash:
//   * chapda — fayl daraxti va loyiha bo'yicha qidiruv;
//   * o'rtada — fayl: qator raqamlari, ranglar. Kodni yozib bo'lmaydi, faqat
//     yashil ramkadagi joylarni o'zgartirasiz — ularni o'zingiz topasiz;
//   * o'ngda — fayl turiga qarab: Model quruvchi, .env sirlari yoki
//     xavfsizlik holati va API manzillari.
// =========================================================================
import { esc, renderTpl, fmtField } from "./tpl.js";
import { ico, fileIco } from "./ui-icons.js";

const $ = (id) => document.getElementById(id);
let draft = null;      // saqlanmagan kod sozlamalari
let mdraft = null;     // saqlanmagan modellar
const closed = new Set();   // yopilgan papkalar


function fileDef(state, data, path) {
  const f = data.catalog.project_files.find((x) => x.path === path);
  if (f) return f;
  if (state.migrations[path]) return { path, lang: "python", lines: state.migrations[path], generated: true };
  return null;
}

function values(state) { return { ...draft.values, ...state.ctx }; }

function fieldHtml(fields, v) {
  return (name) => {
    const f = fields[name];
    const val = v[name];
    if (f.type === "bool") return `<button class="slot toggle ${val ? "on" : ""}" data-field="${name}" title="${esc(f.label)} — bosing">${fmtField(f, val)}</button>`;
    if (f.type === "choice") return `<select class="slot" data-field="${name}" title="${esc(f.label)}">${f.choices.map(([k, l]) => `<option value="${esc(k)}" ${k === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    return `<input class="slot" type="number" data-field="${name}" value="${val}" min="${f.min}" max="${f.max}">`;
  };
}

// Daraxt: papkalar avval, keyin fayllar
function buildTree(paths) {
  const root = { dirs: {}, files: [] };
  paths.forEach((p) => {
    const parts = p.split("/");
    let node = root;
    parts.slice(0, -1).forEach((d, i) => {
      const key = parts.slice(0, i + 1).join("/");
      node.dirs[d] = node.dirs[d] || { key, dirs: {}, files: [] };
      node = node.dirs[d];
    });
    node.files.push(p);
  });
  return root;
}

function treeHtml(node, depth, state, data, current) {
  let html = "";
  Object.keys(node.dirs).sort().forEach((d) => {
    const sub = node.dirs[d];
    const isClosed = closed.has(sub.key);
    html += `<div class="tr-dir" data-dir="${esc(sub.key)}" style="padding-left:${depth * 14 + 6}px">${ico(isClosed ? "chevronRight" : "chevronDown", 12, "tr-chev")} ${ico(isClosed ? "folder" : "folderOpen", 14, "fi fi-dir")} ${esc(d)}</div>`;
    if (!isClosed) html += treeHtml(sub, depth + 1, state, data, current);
  });
  node.files.sort((a, b) => a.localeCompare(b)).forEach((p) => {
    const f = fileDef(state, data, p);
    const name = p.split("/").pop();
    const editable = f && !f.generated && /\{\w+\}/.test(f.lines.join("\n"));
    html += `<div class="tr-file ${p === current ? "active" : ""}" data-file="${esc(p)}" style="padding-left:${depth * 14 + 20}px">
      ${fileIco(p, 14)} ${esc(name)}${editable ? `<i class="tr-dot" title="o'zgartiriladigan joy bor"></i>` : ""}</div>`;
  });
  return html;
}

export function renderCode(state, data, ui, actions) {
  const fields = data.catalog.code_fields;
  if (!draft || draft.room !== state.room.id || draft.saved !== JSON.stringify(state.code)) {
    draft = { room: state.room.id, saved: JSON.stringify(state.code), values: { ...state.code } };
  }
  if (!mdraft || mdraft.room !== state.room.id || mdraft.saved !== JSON.stringify(state.schema.models || [])) {
    mdraft = { room: state.room.id, saved: JSON.stringify(state.schema.models || []), models: JSON.parse(JSON.stringify(state.schema.models || [])) };
  }
  const v = values(state);
  const dirty = JSON.stringify(draft.values) !== draft.saved;
  // "Noldan" startup: loyiha hali yaratilmagan — fayllar terminal buyruqlari bilan paydo bo'ladi
  if (!state.files.length) {
    $("page-code").innerHTML = `<section class="card code-empty">
      ${ico("folderOpen", 40)}
      <h2>Loyiha hali yaratilmagan</h2>
      <p class="muted">Kod fayllari o'z-o'zidan paydo bo'lmaydi — ularni terminal yaratadi:
        <code>django-admin startproject</code> → manage.py va config/, <code>startapp</code> → app/, <code>mkdir</code> → templates, static, media.</p>
      <button class="btn primary" id="codeLocal">${ico("terminal", 14)} 0-qadam: terminalni ochish</button></section>`;
    $("codeLocal").onclick = () => actions.launchStep("local");
    return;
  }
  if (!state.files.includes(ui.file)) ui.file = state.files.includes("config/settings.py") ? "config/settings.py" : state.files[0];
  const file = fileDef(state, data, ui.file);
  const rerender = () => renderCode(state, data, ui, actions);

  // --- Qidiruv (butun loyiha bo'yicha)
  let results = "";
  const q = (ui.search || "").trim().toLowerCase();
  if (q.length >= 2) {
    const hits = [];
    state.files.forEach((p) => {
      const f = fileDef(state, data, p);
      renderTpl(f.lines, { fields, values: v, env: state.env, lang: f.lang }).forEach((l, i) => {
        if (l.text.toLowerCase().includes(q) && hits.length < 60) hits.push({ p, i, text: l.text.trim() });
      });
    });
    results = `<div class="sr-head">${hits.length} ta natija</div>` + hits.map((h) => `
      <div class="sr-item" data-hit="${esc(h.p)}" data-line="${h.i}"><b>${esc(h.p.split("/").pop())}:${h.i + 1}</b>
        <span>${esc(h.text.slice(0, 80))}</span></div>`).join("");
  }

  // --- Fayl matni
  const rows = renderTpl(file.lines, { fields, values: v, env: state.env, lang: file.lang, fieldHtml: fieldHtml(fields, v) });
  const isEnv = file.path === ".env";
  const body = rows.map((r, i) => {
    let html = r.html || " ";
    if (isEnv) {
      const key = r.text.split("=")[0];
      if (state.env[key] !== undefined) {
        const shown = ui.reveal === key ? esc(state.env[key]) : esc(state.env[key].slice(0, 6) + "••••••");
        html = `<span class="tk-v">${esc(key)}</span>=<span class="secret">${shown}</span>
          <span class="env-acts"><button class="mini" data-reveal="${key}">${ui.reveal === key ? "yashir" : "👁"}</button>
          <button class="mini" data-rotate="${key}">↻ rotate</button></span>`;
      }
    }
    return `<div class="ln2 ${r.editable ? "edl" : ""} ${ui.line === i ? "hit" : ""}" ${ui.line === i ? 'id="hitLine"' : ""}><span class="gut">${i + 1}</span><span class="src">${html}</span></div>`;
  }).join("");
  const slots = rows.filter((r) => r.editable).length;

  const banner = file.generated ? `<div class="ed-banner">Bu fayl <b>makemigrations</b> tomonidan avtomatik yaratilgan — qo'lda o'zgartirilmaydi.</div>`
    : file.path === "app/models.py" ? `<div class="ed-banner">Modellar o'ngdagi <b>Model quruvchi</b> bilan o'zgaradi → yangi migratsiya fayli paydo bo'ladi.</div>`
    : isEnv ? `<div class="ed-banner ${state.code.env_gitignored ? "" : "warn"}">${state.code.env_gitignored ? ".env .gitignore da — Git'ga tushmaydi." : "⚠ .env .gitignore da emas — bu fayl Git'ga (va ochiq repoga) tushadi!"}</div>`
    : slots ? `<div class="ed-banner">Bu faylda <b>${slots}</b> ta o'zgartiriladigan joy bor (yashil ramka). Qolgan kod — o'qish va o'rganish uchun.</div>` : "";

  $("page-code").innerHTML = `
    <aside class="card ide-tree">
      <div class="ide-proj">${ico("package", 15)} ${esc(state.ctx.project)} <span class="muted">· ${esc(state.ctx.repo)}</span></div>
      ${state.dev.scratch && !state.dev.finished ? `<button class="ide-local" id="ideLocal">${ico("terminal", 13)} Loyiha qurilmoqda: ${state.dev.done}/${state.dev.total} — terminalni ochish</button>` : ""}
      <input class="ide-search" id="ideSearch" placeholder="Loyihadan qidirish (DEBUG, SECRET, ...)" value="${esc(ui.search || "")}">
      ${results ? `<div class="sr">${results}</div>` : ""}
      <div class="tree">${treeHtml(buildTree(state.files), 0, state, data, file.path)}</div>
    </aside>
    <section class="card ide-editor">
      <div class="ed-head">
        <span class="ed-path">${esc(file.path.split("/").join("  ›  "))}</span>
        <button class="btn primary small" id="btnSaveCode" ${dirty ? "" : "disabled"}>Saqlash · kommit</button>
      </div>
      ${banner}
      <div class="ed-body ${file.lang}" id="fileBox">${body || '<div class="ln2"><span class="gut">1</span><span class="src tk-c"># bo\'sh fayl</span></div>'}</div>
    </section>
    <aside class="card ide-side" id="ideSide"></aside>`;

  // --- O'ng panel
  if (file.path === "app/models.py" || file.generated) renderModelBuilder(state, data, actions, rerender);
  else if (isEnv) renderEnvSide(state, actions);
  else renderInfoSide(state, data, fields, v);

  // --- Hodisalar
  $("fileBox").querySelectorAll("[data-field]").forEach((el) => {
    const name = el.dataset.field, f = fields[name];
    if (f.type === "bool") el.onclick = () => { draft.values[name] = !draft.values[name]; rerender(); };
    else el.onchange = () => { draft.values[name] = f.type === "int" ? parseInt(el.value, 10) : el.value; rerender(); };
  });
  $("btnSaveCode").onclick = () => actions.saveCode({ ...draft.values });
  if ($("ideLocal")) $("ideLocal").onclick = () => actions.launchStep("local");
  const search = $("ideSearch");
  search.oninput = () => { ui.search = search.value; ui.line = null; rerender(); const s = $("ideSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); };
  $("page-code").querySelectorAll("[data-file]").forEach((el) => el.onclick = () => { ui.line = null; actions.openFile(el.dataset.file); });
  $("page-code").querySelectorAll("[data-dir]").forEach((el) => el.onclick = () => {
    closed.has(el.dataset.dir) ? closed.delete(el.dataset.dir) : closed.add(el.dataset.dir); rerender();
  });
  $("page-code").querySelectorAll("[data-hit]").forEach((el) => el.onclick = () => {
    ui.line = Number(el.dataset.line); actions.openFile(el.dataset.hit);
  });
  $("page-code").querySelectorAll("[data-reveal]").forEach((el) => el.onclick = () => {
    ui.reveal = ui.reveal === el.dataset.reveal ? null : el.dataset.reveal; rerender();
  });
  $("page-code").querySelectorAll("[data-rotate]").forEach((el) => el.onclick = () => actions.rotate(el.dataset.rotate));
  $("page-code").querySelectorAll("[data-guide]").forEach((el) => el.onclick = () => actions.guide(el.dataset.guide));
  const hit = $("hitLine");
  if (hit) hit.scrollIntoView({ block: "center" });
}

// --- O'ng panel: xavfsizlik holati (javoblarni bermaydi — qayerdan qidirishni aytadi)
function renderInfoSide(state, data, fields, v) {
  const checks = [
    [!state.code.debug, "DEBUG = False", "qidiring: DEBUG"],
    [state.code.secret_source === "env", "SECRET_KEY .env dan o'qiladi", "qidiring: SECRET_KEY"],
    [state.code.env_gitignored, ".env .gitignore da", "fayl: .gitignore"],
    [state.code.ssl_redirect, "HTTP → HTTPS yo'naltirish", "qidiring: SSL"],
    [state.code.report_mode === "background", "og'ir hisobot fonda", "fayl: app/views.py"],
  ].map(([ok, t, hint]) => `<div class="check ${ok ? "ok" : ""}">${ok ? "✓" : "✗"} ${esc(t)}${ok ? "" : ` <span class="muted">· ${esc(hint)}</span>`}</div>`).join("");
  const eps = data.catalog.endpoints.map((e) => `
    <div class="ep"><span class="method m-${e.method.toLowerCase()}">${e.method}</span> <b class="mono">${esc(e.path)}</b>
      <div class="muted">${esc(e.what)} · ${esc(e.flow)}</div></div>`).join("");
  $("ideSide").innerHTML = `
    <h2>🛡 Xavfsizlik holati</h2>
    <p class="muted">O'zgartiriladigan joylarni kod ichidan o'zingiz toping: chapdagi qidiruv yoki 🟢 belgili fayllar.</p>
    ${checks}
    <p><button class="link" data-guide="secrets">📖 SECRET_KEY</button> · <button class="link" data-guide="https">📖 HTTPS</button>
       · <button class="link" data-guide="git">📖 Git</button></p>
    <h3>API manzillari</h3>${eps}
    <h3>Belgilar</h3>
    <div class="legend2"><span class="slot toggle on">True</span> o'zgartiriladi ·
      <span class="ctx">${esc(state.ctx.domain)}</span> loyihadan · <span class="secret">abc•••</span> .env siri</div>`;
}

function renderEnvSide(state, actions) {
  $("ideSide").innerHTML = `
    <h2>🔑 .env sirlari</h2>
    <p class="muted">.env — sirlar fayli: kalitlar, parollar, tokenlar. Kod ularni <span class="mono">os.environ["..."]</span> orqali o'qiydi.</p>
    <div class="tip info">↻ rotate — yangi tasodifiy qiymat. Eski kalit endi hech narsani ochmaydi, hatto Git tarixida qolgan bo'lsa ham.</div>
    <div class="tip warn">SECRET_KEY almashtirilsa — hamma foydalanuvchi sessiyasi bekor bo'ladi (qayta kirishadi). Oqib ketgan kalitdan qutulishning narxi shu.</div>
    <button class="btn" id="btnRotateAll" style="width:100%">↻ Hamma sirlarni almashtirish</button>
    <h3>TELEGRAM_BOT_TOKEN</h3>
    <p class="muted">@BotFather beradi. Kim bilsa — botingiz nomidan yoza oladi. Faqat .env da saqlang.</p>`;
  $("btnRotateAll").onclick = () => actions.rotate(null);
}

// --- Model quruvchi: Django modellari → models.py va migratsiya
function renderModelBuilder(state, data, actions, rerender) {
  const types = data.catalog.field_types;
  const models = mdraft.models;
  const dirty = JSON.stringify(models) !== mdraft.saved;
  const targets = ["User", ...models.map((m) => m.name)];
  const card = (m, mi) => `
    <div class="mb-card">
      <div class="mb-head"><b>${esc(m.name)}</b><span class="muted mono">app_${esc(m.name.toLowerCase())}</span>
        <button class="mini" data-delmodel="${mi}" title="Modelni o'chirish">✕</button></div>
      <div class="mb-f muted"><span>id</span><span>BigAutoField · PK</span></div>
      ${m.fields.map((f, fi) => `<div class="mb-f"><span>${esc(f.name)}</span>
        <span>${esc(f.type)}${f.type === "ForeignKey" ? " → " + esc(f.to) : f.type === "CharField" ? `(${f.max_length || 200})` : ""}</span>
        <button class="mini" data-delfield="${mi}:${fi}">✕</button></div>`).join("")}
      <div class="mb-add" ${m.fields.length >= L.fields ? "style='display:none'" : ""}>
        <input placeholder="maydon" data-fname="${mi}" maxlength="30">
        <select data-ftype="${mi}">${Object.entries(types).map(([k, l]) => `<option value="${k}">${k} · ${esc(l)}</option>`).join("")}</select>
        <select data-fto="${mi}">${targets.filter((t) => t !== m.name).map((t) => `<option>${esc(t)}</option>`).join("")}</select>
        <button class="mini" data-addfield="${mi}">＋</button>
      </div>
      ${m.fields.length >= L.fields ? `<div class="muted small">${L.fields} ta maydon — limit.</div>` : ""}
    </div>`;
  const L = state.model_limits;
  const nFields = models.reduce((s, m) => s + m.fields.length, 0);
  const nFk = models.reduce((s, m) => s + m.fields.filter((f) => f.type === "ForeignKey").length, 0);
  const load = 1 + 0.03 * models.length + 0.02 * nFk;
  const meter = (v, max, label) => `<div class="mb-meter ${v > max ? "over" : v >= max ? "full" : ""}"><span>${label}</span><b>${v}/${max}</b>
    <i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>`;
  const empty = models.filter((m) => !m.fields.length).map((m) => m.name);
  const tpl = state.model_templates || [];
  $("ideSide").innerHTML = `
    <h2>🗄 Model quruvchi</h2>
    <div class="mb-limits">${meter(models.length, L.models, "modellar")}${meter(nFields, L.total, "maydonlar")}${meter(nFk, L.fk, "bog'lanishlar")}</div>
    <div class="tip ${load > 1.25 ? "warn" : "info"} small">Bazaga yuk: <b>×${load.toFixed(2)}</b> (har jadval +3%, har bog'lanish +2%).
      Ko'p jadval — ko'p so'rov: PostgreSQL tezroq to'ladi. Faqat kerakli modellarni yarating.</div>
    ${empty.length ? `<div class="tip bad small">Maydonsiz model saqlanmaydi: ${empty.map(esc).join(", ")}</div>` : ""}
    ${tpl.length && !models.length ? `<div class="mb-tpl"><b>💡 Tavsiya (biznesingizga mos):</b> ${tpl.map((m) => esc(m.name)).join(", ")}
      <button class="btn small" id="mbTpl">Shablonni qo'yish</button></div>` : ""}
    <p class="muted">Model — bazadagi jadval, maydon — ustun. Saqlasangiz: models.py o'zgaradi va
      <b>makemigrations</b> yangi migratsiya yozadi. Keyin 🚀 Deploy — migrate.</p>
    <div class="mb-card muted"><div class="mb-head"><b>User</b><span class="mono">auth_user</span></div>
      <div class="mb-f"><span>username, password, email…</span><span>Django tayyor beradi</span></div></div>
    ${models.map(card).join("")}
    <div class="mb-new"><input id="mbName" placeholder="Yangi model (masalan Order)" maxlength="30" ${models.length >= L.models ? "disabled" : ""}>
      <button class="btn small" id="mbAdd" ${models.length >= L.models ? "disabled" : ""}>＋ Model</button></div>
    ${models.length >= L.models ? `<div class="muted small">Model limiti to'ldi — keraksizini o'chiring.</div>` : ""}
    <button class="btn primary" id="mbSave" style="width:100%;margin-top:8px" ${dirty ? "" : "disabled"}>Saqlash · makemigrations</button>
    <p><button class="link" data-guide="models">📖 Modellar va migratsiyalar</button></p>`;

  const side = $("ideSide");
  side.querySelectorAll("[data-delmodel]").forEach((el) => el.onclick = () => { models.splice(Number(el.dataset.delmodel), 1); rerender(); });
  side.querySelectorAll("[data-delfield]").forEach((el) => el.onclick = () => {
    const [mi, fi] = el.dataset.delfield.split(":").map(Number); models[mi].fields.splice(fi, 1); rerender();
  });
  side.querySelectorAll("[data-ftype]").forEach((el) => {
    const to = side.querySelector(`[data-fto="${el.dataset.ftype}"]`);
    const sync = () => { to.style.display = el.value === "ForeignKey" ? "" : "none"; };
    el.onchange = sync; sync();
  });
  side.querySelectorAll("[data-addfield]").forEach((el) => el.onclick = () => {
    const mi = el.dataset.addfield;
    const name = side.querySelector(`[data-fname="${mi}"]`).value.trim();
    const type = side.querySelector(`[data-ftype="${mi}"]`).value;
    if (!name) return;
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(name)) { alert("Maydon nomi kichik lotin harfda: masalan price, created_at"); return; }
    if (models[Number(mi)].fields.some((x) => x.name === name)) { alert(`'${name}' allaqachon bor`); return; }
    const f = { name, type };
    if (type === "CharField") f.max_length = 200;
    if (type === "ForeignKey") f.to = side.querySelector(`[data-fto="${mi}"]`).value;
    models[Number(mi)].fields.push(f);
    rerender();
  });
  if ($("mbTpl")) $("mbTpl").onclick = () => { tpl.forEach((m) => models.push(JSON.parse(JSON.stringify(m)))); rerender(); };
  $("mbAdd").onclick = () => {
    const name = $("mbName").value.trim();
    if (!name) return;
    if (!/^[A-Z][A-Za-z0-9]{1,30}$/.test(name)) { alert("Model nomi katta harf bilan, lotincha: masalan Order"); return; }
    if (models.some((m) => m.name === name) || name === "User") { alert(`'${name}' nomi band`); return; }
    models.push({ name, fields: [] }); rerender();
  };
  $("mbSave").onclick = () => actions.saveModels(JSON.parse(JSON.stringify(models)));
}
