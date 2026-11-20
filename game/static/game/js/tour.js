// =========================================================================
// tour.js — yo'riqnoma: ekranning qolgan qismi xiralashadi, kerakli joy
// yoritiladi va yonida "nima qilish kerak" degan izoh chiqadi.
//   startTour([{el: "#toolbar", title, text}, ...], {onDone})
// Oxirgi qadamda `click: true` bo'lsa — "Boshlash" yoritilgan tugmani bosadi.
// =========================================================================

let active = null;

export function startTour(steps, opts = {}) {
  stopTour();
  window.scrollTo(0, 0);
  let i = 0;
  const ov = document.createElement("div");
  ov.className = "tour";
  ov.innerHTML = `<svg class="tour-dim"><path fill-rule="evenodd"/></svg><div class="tour-hole"></div><div class="tour-tip"></div>`;
  document.body.appendChild(ov);
  const hole = ov.querySelector(".tour-hole"), tip = ov.querySelector(".tour-tip"), dim = ov.querySelector(".tour-dim path");
  let target = null;

  const place = () => {
    if (!target) return;
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // qorong'i parda, o'rtasida teshik (evenodd)
    const W = window.innerWidth, H = window.innerHeight;
    const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2, k = 12;
    dim.setAttribute("d", `M0 0H${W}V${H}H0Z M${x + k} ${y}H${x + w - k}Q${x + w} ${y} ${x + w} ${y + k}V${y + h - k}` +
      `Q${x + w} ${y + h} ${x + w - k} ${y + h}H${x + k}Q${x} ${y + h} ${x} ${y + h - k}V${y + k}Q${x} ${y} ${x + k} ${y}Z`);
    const tw = Math.min(380, window.innerWidth - 24);
    tip.style.width = `${tw}px`;
    const th = tip.offsetHeight;
    let top = r.bottom + 14;
    if (top + th > window.innerHeight - 10) top = Math.max(10, r.top - th - 14);
    if (top + th > window.innerHeight - 10) top = Math.max(10, window.innerHeight - th - 10);  // juda katta blok
    const left = Math.min(Math.max(12, r.left), window.innerWidth - tw - 12);
    Object.assign(tip.style, { top: `${top}px`, left: `${left}px` });
  };

  const show = () => {
    const s = steps[i];
    target = document.querySelector(s.el);
    if (!target) { if (i < steps.length - 1) { i++; show(); } else close(); return; }
    target.scrollIntoView({ block: "nearest" });
    const last = i === steps.length - 1;
    tip.innerHTML = `
      <div class="tour-n">${i + 1} / ${steps.length}</div>
      <b>${s.title}</b><p>${s.text}</p>
      <div class="tour-btns">
        <button class="btn ghost small" data-t="skip">Yopish</button>
        <span>${i ? `<button class="btn ghost small" data-t="back">← Orqaga</button>` : ""}
          <button class="btn primary small" data-t="next">${last ? (s.click ? "👉 Boshlash" : "Tushundim ✓") : "Keyingi →"}</button></span>
      </div>`;
    requestAnimationFrame(place);
  };

  const close = () => {
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
    document.removeEventListener("keydown", onKey);
    ov.remove();
    active = null;
    opts.onDone && opts.onDone();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" || e.key === "Enter") tip.querySelector("[data-t=next]")?.click();
  };

  tip.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]");
    if (!t) return;
    if (t.dataset.t === "skip") return close();
    if (t.dataset.t === "back") { i--; return show(); }
    if (i < steps.length - 1) { i++; return show(); }
    const s = steps[i], el = target;
    close();
    if (s.click && el) el.click();
  });
  window.addEventListener("resize", place);
  window.addEventListener("scroll", place, true);
  document.addEventListener("keydown", onKey);
  active = close;
  show();
}

export function stopTour() { if (active) active(); }
