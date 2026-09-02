// netlify/functions/videos.js
//
// API simple pour gérer les vidéos du portfolio.
// GET    -> renvoie { categories, videos } (public, pas de mot de passe requis)
// POST   -> ajoute une vidéo (nécessite le bon mot de passe admin)
// DELETE -> supprime une vidéo par id (nécessite le bon mot de passe admin)
//
// Stockage : on utilise Netlify Blobs (inclus gratuitement, pas de config
// supplémentaire nécessaire, persiste entre les déploiements).

const { getStore } = require("@netlify/blobs");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Lupabe36";
const STORE_NAME = "nexi-data";
const KEY = "videos";

const DEFAULT_DATA = {
  categories: ["Gaming", "Vlog", "Clip", "Short / TikTok", "Dev perso", "Business"],
  videos: []
};

function getVideoStore(event, context) {
  // En environnement Netlify Functions, il faut parfois passer les
  // informations de connexion explicitement pour que Netlify Blobs
  // fonctionne de manière fiable (sinon échec silencieux).
  try {
    return getStore(STORE_NAME);
  } catch (e) {
    return getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID || context?.site?.id,
      token: process.env.NETLIFY_BLOBS_TOKEN
    });
  }
}

function cors(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return cors({});
  }

  let store;
  try {
    store = getVideoStore(event, context);
  } catch (e) {
    return cors({ error: "Erreur de connexion au stockage: " + e.message }, 500);
  }

  if (event.httpMethod === "GET") {
    try {
      const data = (await store.get(KEY, { type: "json" })) || DEFAULT_DATA;
      return cors(data);
    } catch (e) {
      return cors(DEFAULT_DATA);
    }
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      return cors({ error: "Corps de requête invalide." }, 400);
    }

    if (payload.password !== ADMIN_PASSWORD) {
      return cors({ error: "Mot de passe incorrect." }, 401);
    }

    let data;
    try {
      data = (await store.get(KEY, { type: "json" })) || DEFAULT_DATA;
    } catch (e) {
      data = DEFAULT_DATA;
    }

    if (payload.action === "addVideo") {
      const video = payload.video;
      if (!video || !video.title || !video.url || !video.category) {
        return cors({ error: "Champs manquants." }, 400);
      }
      video.id = "v" + Date.now() + Math.random().toString(36).slice(2, 8);
      data.videos.push(video);

      if (!data.categories.includes(video.category)) {
        data.categories.push(video.category);
      }

      try {
        await store.setJSON(KEY, data);
      } catch (e) {
        return cors({ error: "Erreur de sauvegarde: " + e.message }, 500);
      }
      return cors({ success: true, data });
    }

    if (payload.action === "deleteVideo") {
      data.videos = data.videos.filter(v => v.id !== payload.id);
      try {
        await store.setJSON(KEY, data);
      } catch (e) {
        return cors({ error: "Erreur de sauvegarde: " + e.message }, 500);
      }
      return cors({ success: true, data });
    }

    if (payload.action === "checkPassword") {
      // Le mot de passe a déjà été vérifié plus haut (ligne 55-57),
      // donc on arrive ici seulement si le mot de passe est correct.
      return cors({ success: true });
    }

    return cors({ error: "Action inconnue." }, 400);
  }

  return cors({ error: "Méthode non supportée." }, 405);
};
