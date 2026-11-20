// =========================================================================
// api.js — server bilan gaplashish. Har bir javob ochiq xonaning to'liq
// holatini qaytaradi ({ok, state}) yoki o'zbekcha xato ({ok:false, error, effect}).
// =========================================================================

function csrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {                 // sessiya tugagan — kirish sahifasiga
    location.href = "/kirish/?next=/";
    throw new Error("Avval akkauntga kiring.");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server javobi noto'g'ri (${res.status})`);
  }
  if (!data.ok) {
    const err = new Error(data.error || "Xato");
    err.effect = data.effect || "";      // real hayotda nima bo'lardi
    throw err;
  }
  return data;
}

export const api = {
  state: () => call("GET", "/api/state"),
  // xonalar
  createRoom: (kind, name, business, invest = 0) => call("POST", "/api/rooms", { kind, name, business, invest }),
  openRoom: (id) => call("PATCH", `/api/rooms/${id}`, { active: true }),
  renameRoom: (id, name) => call("PATCH", `/api/rooms/${id}`, { name }),
  deleteRoom: (id) => call("DELETE", `/api/rooms/${id}`),
  // bloklar
  addBlock: (kind, x, y, host) => call("POST", "/api/blocks", { kind, x, y, host }),
  moveBlock: (id, x, y) => call("PATCH", `/api/blocks/${id}`, { x, y }),
  configBlock: (id, config) => call("PATCH", `/api/blocks/${id}`, { config }),
  hostBlock: (id, host) => call("PATCH", `/api/blocks/${id}`, { host }),
  renameBlock: (id, name) => call("PATCH", `/api/blocks/${id}`, { name }),
  deleteBlock: (id) => call("DELETE", `/api/blocks/${id}`),
  // strelkalar
  connect: (source, target) => call("POST", "/api/connections", { source, target }),
  disconnect: (id) => call("DELETE", `/api/connections/${id}`),
  // kod va sirlar
  code: (fields) => call("POST", "/api/code", fields),
  rotate: (key) => call("POST", "/api/rotate", { key }),
  models: (models) => call("POST", "/api/models", { models }),
  // 💻 lokal: noldan loyiha (terminal vazifasi)
  dev: (task) => call("POST", "/api/dev", { task }),
  profile: (gh_user) => call("POST", "/api/profile", { gh_user }),
  web: (action, payload = {}) => call("POST", "/api/web", { action, ...payload }),
  // 🚀 ishga tushirish: domain / github / deploy / ssl
  growth: (kind, id) => call("POST", "/api/growth", { kind, id }),
  offers: (offers) => call("POST", "/api/offers", { offers }),
  launch: (step, data) => call("POST", `/api/launch/${step}`, data || {}),
  // vaqt va resurs
  resume: () => call("POST", "/api/resume"),
  withdraw: () => call("POST", "/api/withdraw"),
  saveAdmin: (admin) => call("POST", "/api/admin", { admin }),
  djadmin: (action, payload = {}) => call("POST", "/api/djadmin", { action, ...payload }),
  power: () => call("POST", "/api/power"),
  reset: () => call("POST", "/api/reset"),
};
