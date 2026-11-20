// =========================================================================
// tpl.js — fayl shablonini chizish (Python project.render bilan bir xil qoida)
// va oddiy sintaksis ranglash (PyCharm / VS Code ga o'xshash).
//   {maydon}   — o'zgartiriladigan joy (input/toggle bo'lib chiqadi)
//   [[kalit]]  — xonadan olingan qiymat (domen, IP ...)
//   ${KALIT}   — .env siri (yashirin ko'rsatiladi)
//   "?shart "  — shartli qator
// =========================================================================
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const KEYWORDS = new Set(("def class return import from as if else elif for in while with async await try except " +
  "finally raise and or not is lambda pass yield global True False None server listen location proxy_pass " +
  "server_name ssl_certificate ssl_certificate_key ExecStart WorkingDirectory EnvironmentFile cd ssh git").split(" "));

const TOKEN = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;

// Bitta qatorni ranglash.
export function highlight(line, lang) {
  if (lang === "md" && line.startsWith("#")) return `<span class="tk-h">${esc(line)}</span>`;
  if (lang === "txt" || lang === "md") {
    return line.trim().startsWith("#") ? `<span class="tk-c">${esc(line)}</span>` : esc(line);
  }
  let out = "";
  let m;
  TOKEN.lastIndex = 0;
  let prevWord = "";
  while ((m = TOKEN.exec(line)) !== null) {
    const [tok, com, str, deco, num, word] = m;
    if (com) out += `<span class="tk-c">${esc(com)}</span>`;
    else if (str) out += `<span class="tk-s">${esc(str)}</span>`;
    else if (deco) out += `<span class="tk-d">${esc(deco)}</span>`;
    else if (num) out += `<span class="tk-n">${esc(num)}</span>`;
    else if (word) {
      if (KEYWORDS.has(word)) out += `<span class="tk-k">${esc(word)}</span>`;
      else if (prevWord === "def" || prevWord === "class") out += `<span class="tk-f">${esc(word)}</span>`;
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(word)) out += `<span class="tk-v">${esc(word)}</span>`;
      else out += esc(word);
      prevWord = word;
      continue;
    } else out += esc(tok);
    if (tok.trim()) prevWord = "";
  }
  return out;
}

function condOk(raw, values) {
  const sp = raw.indexOf(" ");
  let cond = sp < 0 ? raw.slice(1) : raw.slice(1, sp);
  const rest = sp < 0 ? "" : raw.slice(sp + 1);
  const neg = cond.startsWith("!");
  cond = cond.replace("!", "");
  let ok;
  if (cond.includes("=")) { const [k, v] = cond.split("="); ok = String(values[k]) === v; }
  else ok = Boolean(values[cond]);
  return [ok !== neg, rest];
}

export function fmtField(f, v) {
  if (f.type === "bool") return f.fmt === "pybool" ? (v ? "True" : "False") : f.fmt === "yesno" ? (v ? "ha" : "yo'q") : (v ? "on" : "off");
  return String(v);
}

/**
 * Shablonni qatorlarga aylantiradi.
 * opts: {fields, values, env, lang, fieldHtml(name), mask(bool)}
 * Qaytaradi: [{text, html, editable}]
 */
export function renderTpl(lines, opts) {
  const { fields = {}, values = {}, env = {}, lang = "python", fieldHtml, mask = true } = opts;
  const out = [];
  for (const raw of lines) {
    let line = raw;
    if (raw.startsWith("?")) {
      const [ok, rest] = condOk(raw, values);
      if (!ok) continue;
      line = rest;
    }
    const list = line.match(/^\s*\[\[(\w+)\]\]\s*$/);
    if (list && Array.isArray(values[list[1]])) {
      values[list[1]].forEach((l) => out.push({ text: l, html: `<span class="gen">${highlight(l, lang)}</span>`, editable: false }));
      continue;
    }
    // Belgilarni ajratamiz: matnni ranglaymiz, maydonlarni keyin qo'yamiz
    const slots = [];
    const marked = line.replace(/\{(\w+)\}|\[\[(\w+)\]\]|\$\{(\w+)\}/g, (all, field, ctx, envKey) => {
      let html, plain;
      if (field && fields[field]) {
        plain = fmtField(fields[field], values[field]);
        html = fieldHtml ? fieldHtml(field) : esc(plain);
      } else if (ctx) {
        plain = String(values[ctx] ?? "");
        html = `<span class="ctx" title="startupdan: ${ctx}">${esc(plain)}</span>`;
      } else if (envKey) {
        const val = env[envKey] ?? "";
        plain = mask ? val.slice(0, 6) + "••••••" : val;
        html = `<span class="secret" title=".env: ${envKey}">${esc(plain)}</span>`;
      } else {
        return all;
      }
      slots.push(html);
      // Bitta "xususiy" belgi (U+E000..): ranglagich uni buzmaydi, keyin input bilan almashtiriladi
      return String.fromCharCode(0xE000 + slots.length - 1);
    });
    const html = highlight(marked, lang).replace(/[-]/g, (ch) => slots[ch.charCodeAt(0) - 0xE000]);
    // Qidiruv uchun oddiy matn
    const plainText = line.replace(/\{(\w+)\}|\[\[(\w+)\]\]|\$\{(\w+)\}/g, (all, field, ctx, envKey) => {
      if (field && fields[field]) return fmtField(fields[field], values[field]);
      if (ctx) return String(values[ctx] ?? "");
      if (envKey) return (env[envKey] ?? "").slice(0, 6) + "••••••";
      return all;
    });
    out.push({ text: plainText, html, editable: slots.length > 0 && /\{(\w+)\}/.test(line) });
  }
  return out;
}
