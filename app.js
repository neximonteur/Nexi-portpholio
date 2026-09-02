/* ==========================================================
   NEXI MONTEUR — PORTFOLIO (version compacte)
   ========================================================== */

const API_URL = "/api/videos";
const FALLBACK_THUMB = "https://images.unsplash.com/photo-1611162616805-6a4bb1d5db7f?q=80&w=800&auto=format&fit=crop";

let state = {
  videos: [],
  categories: [],
  activeFilter: "Tous"
};

let isAdminLoggedIn = false;
let sessionPassword = null;

function catClass(cat) {
  return "b-" + cat.replace(/\s*\/\s*/g, "-").replace(/\s+/g, "-");
}

/* ---------------- Data loading ---------------- */
async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    state.videos = data.videos || [];
    state.categories = data.categories && data.categories.length ? data.categories : [];
  } catch (e) {
    console.error("Erreur de chargement", e);
    showToast("Impossible de charger les vidéos pour le moment.");
  }
}

async function apiAddVideo(video) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addVideo", password: sessionPassword, video })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de l'ajout.");
  return data.data;
}

async function apiDeleteVideo(id) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteVideo", password: sessionPassword, id })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression.");
  return data.data;
}

async function apiCheckPassword(pwd) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "checkPassword", password: pwd })
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, error: data.error };
}

/* ---------------- YouTube thumbnail helper ---------------- */
function extractYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function autoThumb(url) {
  const id = extractYouTubeId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "https://images.unsplash.com/photo-1611162616805-6a4bb1d5db7f?q=80&w=800&auto=format&fit=crop";
}

/* ---------------- Rendering ---------------- */
function renderFilters() {
  const box = document.getElementById("filters");
  const all = ["Tous", ...state.categories];
  box.innerHTML = all.map(cat => `
    <button class="filter-pill ${state.activeFilter === cat ? 'active' : ''}" data-c="${escapeAttr(cat)}">${escapeHtml(cat)}</button>
  `).join("");
  box.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeFilter = btn.dataset.c;
      renderFilters();
      renderGrid();
    });
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const list = state.activeFilter === "Tous"
    ? state.videos
    : state.videos.filter(v => v.category === state.activeFilter);

  if (!list.length) {
    grid.innerHTML = `<div class="empty">Aucune vidéo dans cette catégorie pour le moment.</div>`;
    return;
  }

  grid.innerHTML = list.map(v => `
    <div class="card" data-id="${v.id}">
      <div class="thumb">
        <span class="badge ${catClass(v.category)}">${escapeHtml(v.category)}</span>
        <img src="${escapeAttr(v.thumb)}" alt="${escapeAttr(v.title)}" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
        <div class="playdot">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="white" fill-opacity="0.92"/>
            <path d="M19 15L33 24L19 33V15Z" fill="#262220"/>
          </svg>
        </div>
      </div>
      <div class="info">
        <h3>${escapeHtml(v.title)}</h3>
        <p>${escapeHtml(v.desc || "")}</p>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const video = state.videos.find(v => v.id === card.dataset.id);
      if (video) openVideoModal(video);
    });
  });
}

function renderCategorySelect() {
  const sel = document.getElementById("vCat");
  sel.innerHTML = state.categories.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

function renderAdminList() {
  const box = document.getElementById("adminList");
  if (!state.videos.length) {
    box.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;">Aucune vidéo pour le moment.</p>`;
    return;
  }
  box.innerHTML = state.videos.slice().reverse().map(v => `
    <div class="admin-list-item">
      <img src="${escapeAttr(v.thumb)}" alt="">
      <div class="i">
        <b>${escapeHtml(v.title)}</b>
        <span>${escapeHtml(v.category)}</span>
      </div>
      <button data-id="${v.id}">Supprimer</button>
    </div>
  `).join("");

  box.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        const data = await apiDeleteVideo(btn.dataset.id);
        state.videos = data.videos;
        state.categories = data.categories;
        renderFilters();
        renderGrid();
        renderAdminList();
        showToast("Vidéo supprimée");
      } catch (err) {
        showToast("Erreur : " + err.message);
      }
    });
  });
}

/* ---------------- Utils ---------------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || "").replace(/"/g, "&quot;");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- Video modal (redirect) ---------------- */
function openVideoModal(video) {
  document.getElementById("modalThumb").src = video.thumb;
  document.getElementById("modalTitle").textContent = video.title;
  const catEl = document.getElementById("modalCat");
  catEl.textContent = video.category;
  catEl.className = "modal-cat " + catClass(video.category);
  document.getElementById("modalDesc").textContent = video.desc || "";
  document.getElementById("modalGo").href = video.url;
  document.getElementById("videoModal").classList.add("open");
}
function closeVideoModal() {
  document.getElementById("videoModal").classList.remove("open");
}

/* ---------------- Secret admin access ----------------
   1) Cliquer 5 fois rapidement sur le logo
   2) Taper "admin" au clavier n'importe où sur la page
--------------------------------------------------------- */
function initSecretAdmin() {
  let clickCount = 0;
  let clickTimer = null;
  const logo = document.getElementById("logoTrigger");

  logo.addEventListener("click", () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 1200);
    if (clickCount >= 5) {
      clickCount = 0;
      openAdmin();
    }
  });

  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.key.length === 1) {
      typed += e.key.toLowerCase();
      typed = typed.slice(-10);
      if (typed.includes("admin")) {
        typed = "";
        openAdmin();
      }
    }
  });
}

function openAdmin() {
  document.getElementById("adminOverlay").classList.add("open");
  if (isAdminLoggedIn) {
    showAdminMain();
  } else {
    showAdminLogin();
  }
}
function closeAdmin() {
  document.getElementById("adminOverlay").classList.remove("open");
}
function showAdminLogin() {
  document.getElementById("adminLoginView").style.display = "block";
  document.getElementById("adminMainView").style.display = "none";
  document.getElementById("adminPassInput").value = "";
  document.getElementById("adminLoginMsg").classList.remove("show");
}
function showAdminMain() {
  document.getElementById("adminLoginView").style.display = "none";
  document.getElementById("adminMainView").style.display = "block";
  renderCategorySelect();
  renderAdminList();
}

function initAdminUI() {
  document.getElementById("adminCloseBtn1").addEventListener("click", closeAdmin);
  document.getElementById("adminCloseBtn2").addEventListener("click", closeAdmin);
  document.getElementById("adminOverlay").addEventListener("click", (e) => {
    if (e.target.id === "adminOverlay") closeAdmin();
  });

  document.getElementById("adminLoginBtn").addEventListener("click", async () => {
    const val = document.getElementById("adminPassInput").value;
    const btn = document.getElementById("adminLoginBtn");
    btn.textContent = "Vérification...";
    btn.disabled = true;
    try {
      const result = await apiCheckPassword(val);
      if (result.ok) {
        sessionPassword = val;
        isAdminLoggedIn = true;
        showAdminMain();
      } else {
        const msg = document.getElementById("adminLoginMsg");
        msg.textContent = result.error || "Mot de passe incorrect.";
        msg.classList.add("show");
      }
    } catch (e) {
      const msg = document.getElementById("adminLoginMsg");
      msg.textContent = "Erreur de connexion au serveur.";
      msg.classList.add("show");
    }
    btn.textContent = "Se connecter";
    btn.disabled = false;
  });
  document.getElementById("adminPassInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("adminLoginBtn").click();
  });

  document.getElementById("videoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("vTitle").value.trim();
    const url = document.getElementById("vUrl").value.trim();
    let thumb = document.getElementById("vThumb").value.trim();
    const desc = document.getElementById("vDesc").value.trim();
    const newCat = document.getElementById("vNewCat").value.trim();
    let category = document.getElementById("vCat").value;

    if (newCat) category = newCat;
    if (!thumb) thumb = autoThumb(url);

    const submitBtn = e.target.querySelector(".admin-submit");
    submitBtn.textContent = "Ajout en cours...";
    submitBtn.disabled = true;

    try {
      const data = await apiAddVideo({ title, category, url, thumb, desc });
      state.videos = data.videos;
      state.categories = data.categories;
      renderFilters();
      renderGrid();
      renderCategorySelect();
      renderAdminList();

      document.getElementById("videoForm").reset();
      const msg = document.getElementById("adminAddMsg");
      msg.textContent = "Vidéo ajoutée avec succès.";
      msg.classList.add("show");
      setTimeout(() => msg.classList.remove("show"), 2500);
    } catch (err) {
      showToast("Erreur : " + err.message);
    }

    submitBtn.textContent = "Ajouter la vidéo";
    submitBtn.disabled = false;
  });
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderFilters();
  renderGrid();
  initSecretAdmin();
  initAdminUI();

  document.getElementById("modalCancel").addEventListener("click", closeVideoModal);
  document.getElementById("videoModal").addEventListener("click", (e) => {
    if (e.target.id === "videoModal") closeVideoModal();
  });
  document.getElementById("modalGo").addEventListener("click", closeVideoModal);
});

