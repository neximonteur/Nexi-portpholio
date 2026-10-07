(() => {
"use strict";

const API = "/api/videos";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let DATA = { categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], status: { state: "actif", text: "" } };
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
    DATA = Object.assign({ categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], status: { state: "actif", text: "" } }, j);
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
  if (!DATA.channels.length) { box.innerHTML = '<p class="empty">Les chaînes arrivent bientôt.</p>'; return; }
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
  $("#filters").innerHTML = cats.map((c) => `<button class="chip${c === activeCat ? " on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function renderVideos() {
  const box = $("#videos");
  const list = DATA.videos.filter((v) => activeCat === "Tout" || v.category === activeCat).slice().reverse();
  if (!list.length) { box.innerHTML = '<p class="empty">Aucune vidéo pour l\'instant.</p>'; return; }
  box.innerHTML = list.map((v, i) => `
    <button class="card in" data-id="${esc(v.id)}" style="animation-delay:${Math.min(i, 12) * 40}ms">
      <div class="thumb">${thumbHtml(v)}<span class="play"></span></div>
      <div class="vbody">
        <div class="meta">${tag(v.category)}${Number(v.views) ? `<span>${fmtViews(v.views)} vues</span>` : ""}</div>
        <h3>${esc(v.title)}</h3>
      </div>
    </button>`).join("");
}

function renderReviews() {
  const box = $("#reviews");
  if (!DATA.reviews.length) { box.innerHTML = '<p class="empty">Les premiers avis arrivent bientôt.</p>'; return; }
  box.innerHTML = DATA.reviews.slice().reverse().map((r) => `
    <article class="rev">
      <q>${esc(r.text)}</q>
      <div class="who">${esc(r.author)}${r.role ? `<span>${esc(r.role)}</span>` : ""}</div>
      ${r.proof ? `<button class="btn small ghost" data-proof="${esc(r.id)}">Preuve</button>` : ""}
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
      <button class="ct-copy" data-copy="${i}" aria-label="Copier ${esc(c.name)}">Copier</button>
    </div>`;
  }).join("");
}

function renderFaq() {
  const box = $("#faq");
  box.innerHTML = DATA.faq.map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("");
}

const STATUS_LABELS = { actif: "Actif", bientot: "Bientôt là", inactif: "Pas actif" };
function renderStatus() {
  const p = $("#statusPill"), st = DATA.status || { state: "actif", text: "" };
  const label = st.state === "autre" ? st.text : STATUS_LABELS[st.state];
  if (!label) { p.hidden = true; return; }
  p.className = "status-pill " + st.state;
  p.querySelector("span").textContent = label;
  p.hidden = false;
}

function renderAll() {
  renderStatus();
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
  toast("Copié : " + txt);
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
      if (!c.classList.contains("on") && p * 100 >= parseFloat(c.style.getPropertyValue("--x"))) c.classList.add("on");
    });
  };
  if (reduce) { clips.forEach((c) => c.classList.add("on")); setP(1); return; }
  const t0 = performance.now() + 400, dur = 3400;
  const step = (t) => {
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


  const items = document.querySelectorAll(".toc li,.chap-h,.lead,.cols,.price,.pay,.grid-ch,.filters,.grid-r,.faq,footer .hint,footer .grid-c");
  items.forEach((n) => n.classList.add("rv"));
  if ("IntersectionObserver" in window && !reduce) {
    const ro = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); ro.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach((n) => ro.observe(n));
  } else items.forEach((n) => n.classList.add("seen"));

  const pay = $("#pay");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { pay.classList.add("go"); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(pay);
  } else pay.classList.add("go");
}

/* ---------- Fenêtres ---------- */
let lastFocus = null;
function openModal(id) { lastFocus = document.activeElement; $(id).classList.add("open"); const x = $(id + " .x"); if (x) x.focus(); }
function closeModals() {
  document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function openVideo(id) {
  const v = DATA.videos.find((x) => x.id === id);
  if (!v) return;
  $("#vSheet").innerHTML = `
    <button class="x" data-close aria-label="Fermer">×</button>
    <div class="thumb">${thumbHtml(v)}</div>
    <div class="vbody">
      <div class="meta">${tag(v.category)}${Number(v.views) ? `<span>${Number(v.views).toLocaleString("fr-FR")} vues</span>` : ""}</div>
      <h3>${esc(v.title)}</h3>
      ${v.description ? `<p>${esc(v.description)}</p>` : ""}
      <a class="btn main" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">Voir sur ${esc(platformOf(v.url))}</a>
    </div>`;
  openModal("#vModal");
}
function openProof(id) {
  const r = DATA.reviews.find((x) => x.id === id);
  if (!r || !r.proof) return;
  $("#pSheet").innerHTML = `<button class="x" data-close aria-label="Fermer">×</button><img src="${esc(imgSrc(r.proof))}" alt="Preuve de l'avis de ${esc(r.author)}">`;
  openModal("#pModal");
}

document.addEventListener("click", (e) => {
  const t = e.target;
  const card = t.closest(".card[data-id]");
  if (card) return openVideo(card.dataset.id);
  const chip = t.closest(".chip[data-cat]");
  if (chip) { activeCat = chip.dataset.cat; renderFilters(); renderVideos(); return; }
  const pr = t.closest("[data-proof]");
  if (pr) return openProof(pr.dataset.proof);
  if (t.closest("[data-close]") || t.classList.contains("modal")) return closeModals();
  const op = t.closest("[data-open]");
  if (op) {
    const c = DATA.contacts[Number(op.dataset.open)];
    const link = c && contactLink(c);
    if (!c) return;
    if (!link) return copyText(c.value);
    if (/^(mailto|tel):/i.test(link)) location.href = link;
    else window.open(link, "_blank", "noopener");
    return;
  }
  const cp = t.closest("[data-copy]");
  if (cp) { const c = DATA.contacts[Number(cp.dataset.copy)]; if (c) copyText(c.value); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModals(); if ($("#admin").classList.contains("open")) closeAdmin(); } });

/* ---------- Panneau admin ---------- */
const PLATFORMS = ["YouTube", "TikTok", "Instagram", "Autre"];
const SPEC = {
  videos: {
    label: "Vidéos", add: "Ajouter une vidéo",
    fields: [
      { k: "title", l: "Titre", t: "text", req: 1 },
      { k: "url", l: "Lien de la vidéo (YouTube, TikTok, Instagram…)", t: "url", req: 1 },
      { k: "category", l: "Catégorie", t: "cat", req: 1 },
      { k: "views", l: "Nombre de vues", t: "number" },
      { k: "description", l: "Description", t: "area" },
      { k: "thumb", l: "Miniature (automatique pour YouTube, à ajouter pour TikTok / Instagram)", t: "image", max: 900 }
    ],
    title: (v) => v.title, sub: (v) => `${v.category} · ${fmtViews(v.views)} vues`
  },
  channels: {
    label: "Chaînes", add: "Ajouter une chaîne ou un compte",
    fields: [
      { k: "name", l: "Nom de la chaîne / du compte", t: "text", req: 1 },
      { k: "platform", l: "Plateforme", t: "platform" },
      { k: "handle", l: "Pseudo (ex. @nom)", t: "text" },
      { k: "url", l: "Lien vers la chaîne ou le compte", t: "url" },
      { k: "image", l: "Photo de profil", t: "image", max: 240 }
    ],
    title: (c) => c.name, sub: (c) => c.platform || ""
  },
  reviews: {
    label: "Avis", add: "Ajouter un avis",
    fields: [
      { k: "author", l: "Nom du client", t: "text", req: 1 },
      { k: "role", l: "Chaîne ou activité (optionnel)", t: "text" },
      { k: "text", l: "Son avis", t: "area", req: 1 },
      { k: "proof", l: "Preuve (capture d'écran du message)", t: "image", max: 1400 }
    ],
    title: (r) => r.author, sub: (r) => (r.text || "").slice(0, 60) + (r.proof ? " · avec preuve" : "")
  },
  faq: {
    label: "FAQ", add: "Ajouter une question",
    fields: [
      { k: "question", l: "Question", t: "text", req: 1 },
      { k: "answer", l: "Réponse", t: "area", req: 1 }
    ],
    title: (q) => q.question, sub: (q) => (q.answer || "").slice(0, 60)
  },
  contacts: {
    label: "Contacts", add: "Ajouter un contact",
    fields: [
      { k: "name", l: "Nom (ex. Gmail, Discord)", t: "text", req: 1 },
      { k: "value", l: "Contact (adresse, pseudo…)", t: "text", req: 1 },
      { k: "url", l: "Lien au toucher (optionnel)", t: "url" },
      { k: "image", l: "Logo / image sur le côté", t: "image", max: 200, png: 1 }
    ],
    title: (c) => c.name, sub: (c) => c.value
  }
};
const A = { tab: "videos", editId: null, vals: {}, msg: "", err: false };
const adminEl = $("#admin");

function setMsg(text, err) {
  A.msg = text; A.err = !!err;
  const s = adminEl.querySelector(".status");
  if (s) { s.textContent = text; s.className = "status" + (err ? " err" : text && text.endsWith(".") ? " ok" : ""); }
}

function fieldHtml(f, val) {
  val = val == null ? "" : String(val);
  const id = "f_" + f.k;
  const lab = `<label for="${id}">${esc(f.l)}${f.req ? " *" : ""}</label>`;
  if (f.t === "area") return `<div class="fld">${lab}<textarea id="${id}" data-k="${f.k}">${esc(val)}</textarea></div>`;
  if (f.t === "number") return `<div class="fld">${lab}<input id="${id}" data-k="${f.k}" type="number" inputmode="numeric" min="0" value="${esc(val)}"></div>`;
  if (f.t === "platform") return `<div class="fld">${lab}<select id="${id}" data-k="${f.k}"><option value="">—</option>${PLATFORMS.map((p) => `<option${p === val ? " selected" : ""}>${p}</option>`).join("")}</select></div>`;
  if (f.t === "cat") return `<div class="fld">${lab}<input id="${id}" data-k="${f.k}" list="catlist" value="${esc(val)}" placeholder="Choisis ou écris une nouvelle catégorie"><datalist id="catlist">${DATA.categories.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>`;
  if (f.t === "image") {
    const mine = val.startsWith("img:");
    return `<div class="fld"><label>${esc(f.l)}</label><div class="imgf">
      ${val ? `<img class="pre" src="${esc(imgSrc(val))}" alt="Aperçu">` : ""}
      <div class="row">
        <label class="btn small ghost" style="cursor:pointer">Choisir une photo<input type="file" accept="image/*" hidden data-img="${f.k}"></label>
        ${val ? `<button type="button" class="btn small danger" data-clear="${f.k}">Retirer</button>` : ""}
      </div>
      <input type="text" inputmode="url" autocapitalize="off" placeholder="ou colle un lien d'image" data-k="${f.k}" value="${mine ? "" : esc(val)}">
    </div></div>`;
  }
  return `<div class="fld">${lab}<input id="${id}" data-k="${f.k}" type="text"${f.t === "url" ? ' inputmode="url" autocapitalize="off"' : ""} value="${esc(val)}"></div>`;
}

function renderAdmin() {
  const top = adminEl.scrollTop;
  if (!pwd) {
    adminEl.innerHTML = `
      <div class="admin-bar"><b>Espace admin</b><button data-aclose>Fermer</button></div>
      <div class="admin-in"><div class="login">
        <div class="fld"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password"></div>
        <button class="btn main" id="pwGo">Entrer</button>
        <div class="status${A.err ? " err" : ""}">${esc(A.msg)}</div>
      </div></div>`;
    return;
  }
  const spec = SPEC[A.tab];
  const items = DATA[A.tab].slice().reverse();
  adminEl.innerHTML = `
    <div class="admin-bar"><b>Espace admin</b><span><button data-alock>Verrouiller</button> <button data-aclose>Fermer</button></span></div>
    <div class="admin-in">
      <div class="sbox">
        <h3>Mon statut</h3>
        <div class="row">${[["actif", "Actif"], ["bientot", "Bientôt là"], ["inactif", "Pas actif"], ["autre", "Autre"]].map(([k, l]) => `<button data-state="${k}" class="${(DATA.status || {}).state === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${(DATA.status || {}).state === "autre" ? `<input id="stText" type="text" maxlength="40" placeholder="Ton message (ex. En vacances jusqu'au 15)" value="${esc((DATA.status || {}).text || "")}"><button class="btn small main" style="margin-top:10px" data-stsave>Enregistrer le message</button>` : ""}
      </div>
      <div class="tabs">${Object.keys(SPEC).map((k) => `<button class="${k === A.tab ? "on" : ""}" data-tab="${k}">${SPEC[k].label} (${DATA[k].length})</button>`).join("")}</div>
      <div class="alist">${items.length ? items.map((it) => `<button class="arow${it.id === A.editId ? " sel" : ""}" data-edit="${esc(it.id)}"><span class="t"><b>${esc(spec.title(it))}</b><small>${esc(spec.sub(it))}</small></span><span>Modifier</span></button>`).join("") : '<p class="empty">Rien pour l\'instant.</p>'}</div>
      <div class="form" id="aform">
        <h3>${A.editId ? "Modifier" : spec.add}</h3>
        ${spec.fields.map((f) => fieldHtml(f, A.vals[f.k])).join("")}
        <div class="status${A.err ? " err" : ""}">${esc(A.msg)}</div>
        <div class="acts">
          <button class="btn main" data-save>${A.editId ? "Enregistrer les changements" : "Ajouter"}</button>
          ${A.editId ? '<button class="btn ghost" data-new>Annuler</button><button class="btn danger" data-del>Supprimer</button>' : ""}
        </div>
      </div>
    </div>`;
  adminEl.scrollTop = top;
}

function openAdmin() {
  adminEl.classList.add("open");
  document.body.style.overflow = "hidden";
  A.msg = ""; A.err = false;
  renderAdmin();
}
function closeAdmin() {
  adminEl.classList.remove("open");
  document.body.style.overflow = "";
}

async function shrink(file, max, png) {
  let bmp;
  if (window.createImageBitmap) { try { bmp = await createImageBitmap(file); } catch (e) { bmp = null; } }
  if (!bmp) {
    bmp = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Image illisible."));
      i.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.naturalWidth || bmp.width, h = bmp.naturalHeight || bmp.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext("2d");
  if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const type = png ? "image/png" : "image/jpeg";
  const blob = await new Promise((r) => c.toBlob(r, type, 0.82));
  if (!blob) throw new Error("Impossible de préparer l'image.");
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
  return { type, b64 };
}

async function uploadFor(key, file) {
  const f = SPEC[A.tab].fields.find((x) => x.k === key);
  setMsg("Envoi de l'image…");
  try {
    const { type, b64 } = await shrink(file, f.max || 1000, f.png);
    const r = await api({ action: "uploadImage", contentType: type, data: b64 });
    A.vals[key] = "img:" + r.id;
    A.msg = "Image prête. Pense à enregistrer."; A.err = false;
    renderAdmin();
  } catch (e) { setMsg(e.message, true); }
}

function lock(msg) {
  pwd = ""; sessionStorage.removeItem("nexi_pwd");
  A.msg = msg || ""; A.err = !!msg;
  renderAdmin();
}

async function setStatus(state, text) {
  if (state === "autre" && text === undefined) {
    DATA.status = { state: "autre", text: (DATA.status && DATA.status.text) || "" };
    return renderAdmin();
  }
  try {
    const r = await api({ action: "setStatus", state, text: text || "" });
    DATA = Object.assign(DATA, r.data);
    renderAll(); renderAdmin();
    toast("Statut mis à jour.");
  } catch (e) { toast(e.message); }
}

async function save() {
  const spec = SPEC[A.tab];
  const miss = spec.fields.find((f) => f.req && !String(A.vals[f.k] ?? "").trim());
  if (miss) return setMsg("Remplis le champ : " + miss.l, true);
  setMsg("Enregistrement…");
  try {
    const body = A.editId
      ? { action: "update", collection: A.tab, id: A.editId, item: A.vals }
      : { action: "add", collection: A.tab, item: A.vals };
    const r = await api(body);
    DATA = Object.assign({ categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], status: { state: "actif", text: "" } }, r.data);
    const was = A.editId ? "Modifié." : "Ajouté.";
    A.editId = null; A.vals = {};
    A.msg = was; A.err = false;
    renderAll(); renderAdmin();
  } catch (e) {
    if (/Mot de passe/.test(e.message)) return lock("Mot de passe refusé, reconnecte-toi.");
    setMsg(e.message, true);
  }
}

async function del() {
  if (!A.editId || !confirm("Supprimer définitivement ?")) return;
  try {
    const r = await api({ action: "delete", collection: A.tab, id: A.editId });
    DATA = Object.assign({ categories: [], videos: [], channels: [], reviews: [], contacts: [], faq: [], status: { state: "actif", text: "" } }, r.data);
    A.editId = null; A.vals = {};
    A.msg = "Supprimé."; A.err = false;
    renderAll(); renderAdmin();
  } catch (e) { setMsg(e.message, true); }
}

async function login() {
  const v = $("#pw", adminEl).value;
  if (!v) return;
  pwd = v;
  try {
    await api({ action: "checkPassword" });
    sessionStorage.setItem("nexi_pwd", pwd);
    A.msg = ""; A.err = false;
    renderAdmin();
  } catch (e) {
    pwd = "";
    setMsg(e.message, true);
  }
}

adminEl.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-aclose]")) return closeAdmin();
  if (t.closest("[data-alock]")) return lock();
  if (t.closest("#pwGo")) return login();
  const tab = t.closest("[data-tab]");
  if (tab) { A.tab = tab.dataset.tab; A.editId = null; A.vals = {}; A.msg = ""; return renderAdmin(); }
  const ed = t.closest("[data-edit]");
  if (ed) {
    const it = DATA[A.tab].find((x) => x.id === ed.dataset.edit);
    if (it) { A.editId = it.id; A.vals = { ...it }; A.msg = ""; renderAdmin(); $("#aform", adminEl).scrollIntoView({ behavior: "smooth" }); }
    return;
  }
  if (t.closest("[data-new]")) { A.editId = null; A.vals = {}; A.msg = ""; return renderAdmin(); }
  const stb = t.closest("[data-state]");
  if (stb) return setStatus(stb.dataset.state);
  if (t.closest("[data-stsave]")) return setStatus("autre", ($("#stText", adminEl) || {}).value || "");
  if (t.closest("[data-save]")) return save();
  if (t.closest("[data-del]")) return del();
  const cl = t.closest("[data-clear]");
  if (cl) { A.vals[cl.dataset.clear] = ""; return renderAdmin(); }
});
adminEl.addEventListener("input", (e) => { const k = e.target.dataset && e.target.dataset.k; if (k) A.vals[k] = e.target.value; });
adminEl.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.img;
  if (k && e.target.files && e.target.files[0]) uploadFor(k, e.target.files[0]);
});
adminEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "pw") login(); });

/* Accès caché : 5 touchers rapides sur le logo, ou taper « admin » au clavier */
let taps = [];
$("#logo").addEventListener("click", () => {
  const now = Date.now();
  taps = taps.filter((t) => now - t < 2500);
  taps.push(now);
  if (taps.length >= 5) { taps = []; openAdmin(); }
});
let keys = "";
addEventListener("keydown", (e) => {
  const tn = e.target && e.target.tagName;
  if (tn === "INPUT" || tn === "TEXTAREA" || tn === "SELECT") return;
  keys = (keys + e.key.toLowerCase()).slice(-5);
  if (keys === "admin") { keys = ""; openAdmin(); }
});

/* ---------- Démarrage ---------- */
runTimeline();
setupScroll();
load();
})();
