(() => {
"use strict";

const API = "/api/videos";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let DATA = { categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], compare: [], theme: "foret", status: { state: "actif", text: "" } };
let activeCat = "Tout";
let pwd = sessionStorage.getItem("nexi_pwd") || "";

/* ---------- Outils ---------- */
const CAT_COLORS = { "Gaming": "#5B8CFF", "Vlog": "#3FBF8A", "Clip": "#FF6B4A", "Short / TikTok": "#D4F25A", "Dev perso": "#A59BFF", "Business": "#F2EEE3" };
const EXTRA = ["#FFB547", "#4FD1D9", "#FF8FB1", "#B8E986"];
function catColor(c) {
  if (CAT_COLORS[c]) return CAT_COLORS[c];
  let h = 0;
  for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) % EXTRA.length;
  return EXTRA[h];
}
function textOn(bg) {
  const n = parseInt(bg.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 135 ? "#13151B" : "#fff";
}
function tag(c) {
  const bg = catColor(c);
  return `<span class="tag" style="background:${bg};color:${textOn(bg)}">${esc(c)}</span>`;
}
function fmtViews(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",").replace(",0", "") + " M";
  if (n >= 1e4) return Math.round(n / 1e3) + " k";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".", ",").replace(",0", "") + " k";
  return String(n);
}
const imgSrc = (v) => (String(v).startsWith("img:") ? API + "?img=" + String(v).slice(4) : v);
function ytId(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : "";
}
function platformOf(url) {
  const u = String(url).toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("instagram.com")) return "Instagram";
  return "le lien";
}
function thumbHtml(v) {
  const col = catColor(v.category);
  const p = platformOf(v.url);
  let src = v.thumb ? imgSrc(v.thumb) : ytId(v.url) ? `https://i.ytimg.com/vi/${ytId(v.url)}/hqdefault.jpg` : "";
  if (!src) return `<div class="ph" style="--c:${col}">${esc(p === "le lien" ? v.category : p)}</div>`;
  return `<img src="${esc(src)}" alt="" loading="lazy" data-p="${esc(p === "le lien" ? v.category : p)}" data-c="${col}" onerror="imgFail(this)">`;
}
window.imgFail = (el) => {
  const d = document.createElement("div");
  d.className = "ph";
  d.style.setProperty("--c", el.dataset.c || "#223027");
  d.textContent = el.dataset.p || "";
  el.replaceWith(d);
};

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Données ---------- */
async function api(body) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pwd, ...body }) });
  let j = {};
  try { j = await r.json(); } catch (e) { /* ignore */ }
  if (!r.ok || j.error) throw new Error(j.error || "Erreur " + r.status);
  return j;
}
async function load() {
  try {
    const r = await fetch(API, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || r.status);
    DATA = Object.assign({ categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], compare: [], theme: "foret", status: { state: "actif", text: "" } }, j);
    $("#vErr").innerHTML = "";
  } catch (e) {
    $("#vErr").innerHTML = `<div class="error">Impossible de charger les données (${esc(e.message)}). Recharge la page dans un instant.</div>`;
  }
  renderAll();
}

/* ---------- Rendu ---------- */
let shown = 0;
function renderViews() {
  const total = DATA.videos.reduce((s, v) => s + (Number(v.views) || 0), 0);
  const el = $("#totalViews");
  const from = shown;
  shown = total;
  if (reduce || from === total) { el.textContent = total.toLocaleString("fr-FR"); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (total - from) * e).toLocaleString("fr-FR");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderChannels() {
  const box = $("#channels");
  if (!DATA.channels.length) { box.innerHTML = '<p class="empty">' + tr("e_ch") + '</p>'; return; }
  box.innerHTML = DATA.channels.map((c) => {
    const ini = esc((c.name || "?").trim().charAt(0).toUpperCase());
    const av = c.image ? `<img src="${esc(imgSrc(c.image))}" alt="" loading="lazy" data-i="${ini}" onerror="this.replaceWith(this.dataset.i)">` : ini;
    const inner = `<div class="avatar">${av}</div><div><b>${esc(c.name)}</b>${c.handle ? `<span>${esc(c.handle)}</span><br>` : ""}${c.platform ? `<span class="plat">${esc(c.platform)}</span>` : ""}</div>`;
    return c.url ? `<a class="chan" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="chan">${inner}</div>`;
  }).join("");
}

function renderFilters() {
  const cats = ["Tout", ...DATA.categories.filter((c) => DATA.videos.some((v) => v.category === c))];
  if (!cats.includes(activeCat)) activeCat = "Tout";
  $("#filters").innerHTML = cats.map((c) => `<button class="chip${c === activeCat ? " on" : ""}" data-cat="${esc(c)}">${c === "Tout" ? tr("all") : esc(c)}</button>`).join("");
}

function renderVideos() {
  const box = $("#videos");
  const list = DATA.videos.filter((v) => activeCat === "Tout" || v.category === activeCat).slice().reverse();
  if (!list.length) { box.innerHTML = '<p class="empty">Aucune vidéo pour l\'instant.</p>'; return; }
  box.innerHTML = list.map((v, i) => `
    <button class="card in" data-id="${esc(v.id)}" style="animation-delay:${Math.min(i, 12) * 40}ms">
      <div class="thumb">${thumbHtml(v)}<span class="play"></span></div>
      <div class="vbody">
        <div class="meta">${tag(v.category)}${Number(v.views) ? `<span>${fmtViews(v.views)} ${tr("v_views")}</span>` : ""}</div>
        <h3>${esc(v.title)}</h3>
      </div>
    </button>`).join("");
}

function renderReviews() {
  const box = $("#reviews");
  if (!DATA.reviews.length) { box.innerHTML = '<p class="empty">' + tr("e_rev") + '</p>'; return; }
  box.innerHTML = DATA.reviews.slice().reverse().map((r) => `
    <article class="rev">
      <q>${esc(r.text)}</q>
      <div class="who">${esc(r.author)}${r.role ? `<span>${esc(r.role)}</span>` : ""}</div>
      ${r.proof ? `<button class="btn small ghost" data-proof="${esc(r.id)}">${tr("proof")}</button>` : ""}
    </article>`).join("");
}

const SVG_MAIL = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
function contactLink(c) {
  if (c.url) return c.url;
  if (/^\S+@\S+\.\S+$/.test(c.value)) return "mailto:" + c.value;
  if (/^https?:\/\//i.test(c.value)) return c.value;
  return "";
}
function renderContacts() {
  const box = $("#contacts");
  if (!DATA.contacts.length) { box.innerHTML = '<p class="hint">Aucun contact pour l\'instant.</p>'; return; }
  box.innerHTML = DATA.contacts.map((c, i) => {
    const ini = esc((c.name || "?").trim().charAt(0).toUpperCase());
    const ico = c.image ? `<img src="${esc(imgSrc(c.image))}" alt="" data-i="${ini}" onerror="this.replaceWith(this.dataset.i)">` : /mail/i.test(c.name) ? SVG_MAIL : ini;
    return `<div class="ct">
      <button class="ct-main" data-open="${i}"><span class="ico">${ico}</span><span><b>${esc(c.name)}</b><span>${esc(c.value)}</span></span></button>
      <button class="ct-copy" data-copy="${i}" aria-label="${esc(c.name)}">${tr("copyb")}</button>
    </div>`;
  }).join("");
}

function renderFaq() {
  const box = $("#faq");
  box.innerHTML = DATA.faq.map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("");
}

const STATUS_KEYS = { actif: "s_actif", bientot: "s_bientot", inactif: "s_inactif" };
function renderStatus() {
  const p = $("#statusPill"), st = DATA.status || { state: "actif", text: "" };
  const label = st.state === "autre" ? st.text : tr(STATUS_KEYS[st.state]);
  if (!label) { p.hidden = true; return; }
  p.className = "status-pill " + st.state;
  p.querySelector("span").textContent = label;
  p.hidden = false;
}

const THEMES = [
  ["foret", "Forêt", "#0F1411", "#D4F25A"], ["creme", "Crème", "#F6F1E7", "#2F6B4F"], ["minuit", "Minuit", "#0B1020", "#4CC9F0"],
  ["neon", "Néon", "#09090B", "#FF2EA6"], ["couchant", "Couchant", "#1A1022", "#FF9F43"], ["papier", "Papier", "#FAF8F3", "#D62828"],
  ["ocean", "Océan", "#EAF4FB", "#0077B6"], ["rose", "Rose", "#FBEFF1", "#B5254F"], ["retro", "Rétro", "#EFE4CC", "#C2570C"], ["or", "Noir & or", "#0C0B09", "#D4AF37"]
];
function applyTheme(id) {
  id = THEMES.some((t) => t[0] === id) ? id : "foret";
  document.documentElement.setAttribute("data-theme", id);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0F1411";
}
const UKEY = "nexi-theme-user";
const userTheme = () => { try { return localStorage.getItem(UKEY); } catch (e) { return null; } };
function themeFx(id) {
  const r = document.documentElement;
  r.classList.add("tt"); applyTheme(id);
  setTimeout(() => r.classList.remove("tt"), 700);
}
function openPicker(kind) {
  const cur = document.documentElement.getAttribute("data-theme");
  const head = `<button class="x" data-close aria-label="${esc(tr("close"))}">×</button>`;
  $("#kSheet").innerHTML = kind === "theme"
    ? `${head}<div class="pick"><h3>${esc(tr("theme_t"))}</h3><div class="pgrid">${THEMES.map(([id, l, bg, ac]) => `<button data-pick-theme="${id}" class="${cur === id ? "on" : ""}"><span class="sw" style="background:linear-gradient(135deg,${bg} 50%,${ac} 50%)"></span>${l}</button>`).join("")}</div>${userTheme() ? `<button class="btn small ghost" data-pick-reset>${esc(tr("theme_def"))}</button>` : ""}</div>`
    : `${head}<div class="pick"><h3>${esc(tr("lang_t"))}</h3><div class="pgrid">${LANGS.map(([c, s, n]) => `<button data-pick-lang="${c}" class="${lang === c ? "on" : ""}"><span class="sw" style="display:grid;place-items:center;font-weight:800;font-size:.8rem">${s}</span>${n}</button>`).join("")}</div></div>`;
  openModal("#kModal");
}
async function setTheme(id) {
  try { localStorage.removeItem(UKEY); } catch (e) { /* ok */ }
  themeFx(id);
  try {
    const r = await api({ action: "setTheme", theme: id });
    DATA = Object.assign(DATA, r.data);
    renderAdmin();
    toast("Thème changé.");
  } catch (e) { toast(e.message); }
}

/* ---------- Avant / après (vidéos) ---------- */
const ICON_SVG = (p) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const SPK = '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/>';
const ICON_ON = ICON_SVG(SPK + '<path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>');
const ICON_OFF = ICON_SVG(SPK + '<path d="m16 9.5 5 5m0-5-5 5"/>');
const ICON_GRIP = ICON_SVG('<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>');
let soundOn = false;
const vplayers = [];
function syncSound(p) {
  const pos = p.pos / 100, on = soundOn && p.sound;
  const loud = pos >= 0.5 ? p.b : p.a, quiet = pos >= 0.5 ? p.a : p.b;
  quiet.muted = true;
  loud.muted = !on;
  loud.volume = 1;
  p.btn.innerHTML = on ? ICON_ON : ICON_OFF;
  p.btn.setAttribute("aria-label", tr("snd"));
}
["pointerdown", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, () => {
  if (soundOn) return;
  soundOn = true;
  vplayers.forEach(syncSound);
}, { passive: true }));

function renderCompare() {
  const box = $("#compare"), sec = $("#avantapres"), toc = $("#toc-ba");
  vplayers.length = 0;
  const list = DATA.compare || [];
  sec.hidden = toc.hidden = !list.length;
  box.innerHTML = list.map((c, i) => `<div class="cmp rv seen" data-i="${i}">
    ${c.title ? `<h3>${esc(c.title)}</h3>` : ""}
    <div class="vba" style="--p:50%">
      <video class="before" data-src="${esc(c.before)}" muted loop playsinline preload="none"></video>
      <video class="after" data-src="${esc(c.after)}" muted loop playsinline preload="none"></video>
      <span class="vtag a">${tr("before")}</span><span class="vtag b">${tr("after")}</span>
      <div class="vbar"></div><div class="vgrip" aria-hidden="true">${ICON_GRIP}</div>
      <input type="range" min="0" max="100" value="50" aria-label="Comparer avant et après">
      <button class="snd" type="button" aria-label="${esc(tr("snd"))}">${ICON_OFF}</button>
    </div>
    ${c.caption ? `<p>${esc(c.caption)}</p>` : ""}
  </div>`).join("");
  box.querySelectorAll(".cmp").forEach((el) => {
    const w = el.querySelector(".vba"), b = w.querySelector("video.before"), a = w.querySelector("video.after");
    const p = { b, a, pos: 50, sound: true, btn: w.querySelector(".snd") };
    vplayers.push(p);
    w.querySelector("input").addEventListener("input", (e) => { p.pos = +e.target.value; w.style.setProperty("--p", p.pos + "%"); syncSound(p); });
    p.btn.addEventListener("click", (e) => { e.stopPropagation(); p.sound = !p.sound; soundOn = true; syncSound(p); });
    [b, a].forEach((v) => v.addEventListener("error", () => {
      if (!w.querySelector(".vnote")) w.insertAdjacentHTML("beforeend", '<div class="vnote">Vidéo introuvable. Vérifie le lien dans l’admin.</div>');
    }));
    b.addEventListener("timeupdate", () => { if (Math.abs(a.currentTime - b.currentTime) > 0.3) a.currentTime = b.currentTime; });
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        [b, a].forEach((v) => { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); });
        syncSound(p);
      } else [b, a].forEach((v) => v.pause());
    }), { threshold: 0.35 }).observe(w);
  });
}

function renderAll() {
  try { localStorage.setItem("nexi-theme", DATA.theme); } catch (e) { /* ok */ }
  applyTheme(userTheme() || DATA.theme);
  renderStatus();
  renderCompare();
  renderViews(); renderChannels(); renderFilters(); renderVideos(); renderReviews(); renderFaq(); renderContacts();
}

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch (e) {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e2) { /* ignore */ }
    ta.remove();
  }
  toast(tr("copied") + txt);
}

/* ---------- Animations ---------- */
function runTimeline() {
  const tl = $("#tl");
  const clips = [...tl.querySelectorAll(".clip")];
  const head = $("#head"), tc = $("#tc");
  const total = 600; // 10 minutes
  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const setP = (p) => {
    head.style.left = p * 100 + "%";
    tc.textContent = fmt(p * total);
    clips.forEach((c) => {
      c.classList.toggle("on", p * 100 >= parseFloat(c.style.getPropertyValue("--x")));
    });
  };
  let stop = false, drag = false;
  const inner = tl.querySelector(".tl-in");
  const at = (e) => { stop = true; const r = inner.getBoundingClientRect(); setP(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); };
  tl.addEventListener("pointerdown", (e) => { drag = true; try { tl.setPointerCapture(e.pointerId); } catch (e2) { /* ok */ } at(e); });
  tl.addEventListener("pointermove", (e) => { if (drag) at(e); });
  ["pointerup", "pointercancel"].forEach((ev) => tl.addEventListener(ev, () => { drag = false; }));
  if (reduce) { clips.forEach((c) => c.classList.add("on")); setP(1); return; }
  const t0 = performance.now() + 400, dur = 3400;
  const step = (t) => {
    if (stop) return;
    const k = Math.max(0, Math.min(1, (t - t0) / dur));
    setP(k * k * (3 - 2 * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setupScroll() {
  const prog = $("#prog");
  let tick = false;
  const upd = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    tick = false;
  };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();


  const items = document.querySelectorAll(".toc li,.chap-h,.lead,.cols,.cmp,.grid-ch,.filters,.grid-r,.faq,footer .hint,footer .grid-c");
  items.forEach((n) => n.classList.add("rv"));
  if ("IntersectionObserver" in window && !reduce) {
    const ro = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); ro.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach((n) => ro.observe(n));
  } else items.forEach((n) => n.classList.add("seen"));

}

/* ---------- Effets vivants ---------- */
let typeTimer = 0, spyMark = null;
function typeHero() {
  const h = $("#h1"), full = tr("hero_h1");
  clearTimeout(typeTimer);
  h.classList.remove("caret"); h.style.minHeight = "";
  if (reduce) { h.textContent = full; return; }
  h.textContent = full;
  h.style.minHeight = h.offsetHeight + "px";
  h.textContent = ""; h.classList.add("caret");
  let i = 0;
  const tick = () => {
    h.textContent = full.slice(0, ++i);
    if (i < full.length) typeTimer = setTimeout(tick, 34 + Math.random() * 46);
    else typeTimer = setTimeout(() => h.classList.remove("caret"), 1800);
  };
  typeTimer = setTimeout(tick, 350);
}

function setupFx() {
  const ids = ["presentation", "chaines", "montages", "avantapres", "avis", "faq-s", "contact"];
  const nowbar = $("#nowbar"), nN = $("#nowN"), nT = $("#nowT");
  let cur = "", footerIn = false;
  const fab = $("#fab");
  spyMark = () => {
    const n = ids.indexOf(cur) + 1;
    document.querySelectorAll(".toc li").forEach((li) => li.classList.toggle("on", li.firstElementChild.getAttribute("href") === "#" + cur));
    if (!n) return;
    nowbar.classList.add("show");
    nN.textContent = n; nT.textContent = tr("t" + n);
    [nN, nT].forEach((x) => { x.classList.remove("swap"); void x.offsetWidth; x.classList.add("swap"); });
  };
  const fabUpd = () => fab.classList.toggle("show", scrollY > 420 && !footerIn);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cur = e.target.id; spyMark(); } }), { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    new IntersectionObserver((es) => { footerIn = es[0].isIntersecting; fabUpd(); }, { threshold: 0.05 }).observe($("#contact"));
  }
  addEventListener("scroll", () => { if (scrollY < 300) nowbar.classList.remove("show"); fabUpd(); }, { passive: true });
  if (reduce) return;
  const untilt = () => document.querySelectorAll(".card.tilt").forEach((c) => c.classList.remove("tilt"));
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".card");
    if (c) {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--ry", ((x - 0.5) * 8).toFixed(1) + "deg");
      c.style.setProperty("--rx", ((0.5 - y) * 6).toFixed(1) + "deg");
      c.style.setProperty("--mx", x * 100 + "%"); c.style.setProperty("--my", y * 100 + "%");
      c.classList.
