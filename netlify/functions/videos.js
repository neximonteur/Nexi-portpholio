// Fonction serveur du site de Nexi.
// GET                -> toutes les données publiques (vidéos, chaînes, avis, contacts)
// GET ?img=ID        -> une image envoyée depuis le panneau admin
// POST + mot de passe -> add / update / delete / uploadImage / checkPassword
// Stockage : Netlify Blobs (connectLambda : aucun token à gérer, rien n'expire).

const { getStore, connectLambda } = require("@netlify/blobs");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const STORE_NAME = "nexi-data";
const IMG_STORE = "nexi-images";
const KEY = "videos"; // même clé qu'avant : les vidéos déjà ajoutées sont conservées

const DEFAULT_CATEGORIES = ["Gaming", "Vlog", "Clip", "Short / TikTok", "Dev perso", "Business"];
const DEFAULT_CONTACTS = [
  { id: "c-gmail", name: "Gmail", value: "neximonteur@gmail.com", url: "mailto:neximonteur@gmail.com", image: "" },
  { id: "c-discord", name: "Discord", value: "xsasuke2.0_30853", url: "", image: "" }
];

const DEFAULT_FAQ = [
  { id: "q-prix", question: "Combien ça coûte ?", answer: "Pour une vidéo de 10 minutes avec une intro, un hook dynamique, un montage efficace du début à la fin et quelques effets, on est sur 50 €. Le prix est négociable selon ton projet." },
  { id: "q-paiement", question: "Comment se passe le paiement ?", answer: "Sur PayPal, une fois la vidéo montée. Je t'envoie la vidéo entière avec un filigrane, on fait les ajustements, puis je t'envoie la première moitié sans filigrane. Tu paies la moitié, je t'envoie la seconde moitié, et tu paies le reste." },
  { id: "q-delai", question: "Quels sont les délais ?", answer: "Je rends mes montages rapidement. Dis-moi ta date limite dans ton message et on s'organise ensemble." },
  { id: "q-retouches", question: "Je peux demander des modifications ?", answer: "Oui, je fais tous les ajustements nécessaires avant le rendu final." },
  { id: "q-formats", question: "Quels types de vidéos tu montes ?", answer: "Des vidéos YouTube, des shorts, des TikTok, et d'autres formats comme des pubs ou du marketing. Je suis flexible sur toutes les niches." }
];

const COLLECTIONS = {
  videos: { prefix: "v", fields: ["title", "url", "category", "description", "thumb", "views"], required: ["title", "url", "category"], images: ["thumb"], links: ["url"], linkRequired: true },
  channels: { prefix: "ch", fields: ["name", "platform", "handle", "url", "image"], required: ["name"], images: ["image"], links: ["url"] },
  reviews: { prefix: "r", fields: ["author", "role", "text", "proof"], required: ["author", "text"], images: ["proof"], links: [] },
  faq: { prefix: "q", fields: ["question", "answer"], required: ["question", "answer"], images: [], links: [] },
  contacts: { prefix: "c", fields: ["name", "value", "url", "image"], required: ["name", "value"], images: ["image"], links: ["url"], mailto: true }
};

function cors(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function normalize(d) {
  d = d || {};
  return {
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : DEFAULT_CATEGORIES.slice(),
    videos: Array.isArray(d.videos) ? d.videos : [],
    channels: Array.isArray(d.channels) ? d.channels : [],
    reviews: Array.isArray(d.reviews) ? d.reviews : [],
    faq: Array.isArray(d.faq) ? d.faq : DEFAULT_FAQ.map((q) => ({ ...q })),
    contacts: Array.isArray(d.contacts) ? d.contacts : DEFAULT_CONTACTS.map((c) => ({ ...c }))
  };
}

function okImage(v) {
  return /^img:[a-z0-9]{6,40}$/i.test(v) || /^https?:\/\/\S+$/i.test(v) ? v : "";
}

function okLink(v, allowMailto) {
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (allowMailto && /^(mailto|tel):\S+$/i.test(v)) return v;
  return "";
}

function clean(name, item) {
  const spec = COLLECTIONS[name];
  item = item || {};
  const out = {};
  for (const f of spec.fields) {
    let v = item[f];
    if (f === "views") {
      v = Math.max(0, Math.floor(Number(v) || 0));
    } else {
      v = typeof v === "string" ? v.trim().slice(0, f === "text" || f === "description" || f === "answer" ? 2000 : 500) : "";
      if (spec.images.includes(f)) v = okImage(v);
      if (spec.links.includes(f)) v = okLink(v, spec.mailto);
    }
    out[f] = v;
  }
  for (const r of spec.required) if (!out[r]) return null;
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({});

  let store, images;
  try {
    connectLambda(event);
    store = getStore(STORE_NAME);
    images = getStore(IMG_STORE);
  } catch (e) {
    return cors({ error: "Erreur de connexion au stockage: " + e.message }, 500);
  }

  async function dropImage(v) {
    if (typeof v === "string" && v.startsWith("img:")) {
      try { await images.delete(v.slice(4)); } catch (e) { /* pas grave */ }
    }
  }

  if (event.httpMethod === "GET") {
    const imgId = (event.queryStringParameters || {}).img;
    if (imgId) {
      if (!/^[a-z0-9]{6,40}$/i.test(imgId)) return cors({ error: "Image introuvable." }, 404);
      try {
        const r = await images.getWithMetadata(imgId, { type: "text" });
        if (!r) return cors({ error: "Image introuvable." }, 404);
        return {
          statusCode: 200,
          isBase64Encoded: true,
          headers: {
            "Content-Type": (r.metadata && r.metadata.contentType) || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          },
          body: r.data
        };
      } catch (e) {
        return cors({ error: "Erreur de lecture de l'image: " + e.message }, 500);
      }
    }
    try {
      const data = normalize(await store.get(KEY, { type: "json" }));
      return cors(data);
    } catch (e) {
      return cors({ error: "Erreur de lecture: " + e.message }, 500);
    }
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      return cors({ error: "Corps de requête invalide." }, 400);
    }

    if (!ADMIN_PASSWORD) return cors({ error: "ADMIN_PASSWORD n'est pas défini dans Netlify." }, 500);
    if (payload.password !== ADMIN_PASSWORD) return cors({ error: "Mot de passe incorrect." }, 401);
    if (payload.action === "checkPassword") return cors({ success: true });

    if (payload.action === "uploadImage") {
      const type = payload.contentType;
      const b64 = String(payload.data || "");
      if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return cors({ error: "Format d'image non supporté." }, 400);
      if (!b64 || b64.length > 3000000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return cors({ error: "Image invalide ou trop lourde." }, 413);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try {
        await images.set(id, b64, { metadata: { contentType: type } });
      } catch (e) {
        return cors({ error: "Erreur d'enregistrement de l'image: " + e.message }, 500);
      }
      return cors({ success: true, id });
    }

    // Anciens noms d'actions (au cas où une vieille version du site est en cache)
    if (payload.action === "addVideo") { payload = { ...payload, action: "add", collection: "videos", item: payload.video }; }
    if (payload.action === "deleteVideo") { payload = { ...payload, action: "delete", collection: "videos" }; }

    const spec = COLLECTIONS[payload.collection];
    if (!spec || !["add", "update", "delete"].includes(payload.action)) return cors({ error: "Action inconnue." }, 400);

    let data;
    try {
      data = normalize(await store.get(KEY, { type: "json" }));
    } catch (e) {
      return cors({ error: "Erreur de lecture: " + e.message }, 500);
    }
    const list = data[payload.collection];

    if (payload.action === "add") {
      const item = clean(payload.collection, payload.item);
      if (!item) return cors({ error: "Champs manquants ou invalides." }, 400);
      item.id = spec.prefix + Date.now() + Math.random().toString(36).slice(2, 6);
      list.push(item);
      if (payload.collection === "videos" && !data.categories.includes(item.category)) data.categories.push(item.category);
    }

    if (payload.action === "update") {
      const i = list.findIndex((x) => x.id === payload.id);
      if (i < 0) return cors({ error: "Élément introuvable." }, 404);
      const item = clean(payload.collection, { ...list[i], ...(payload.item || {}) });
      if (!item) return cors({ error: "Champs manquants ou invalides." }, 400);
      for (const f of spec.images) if (list[i][f] !== item[f]) await dropImage(list[i][f]);
      item.id = list[i].id;
      list[i] = item;
      if (payload.collection === "videos" && !data.categories.includes(item.category)) data.categories.push(item.category);
    }

    if (payload.action === "delete") {
      const old = list.find((x) => x.id === payload.id);
      if (old) for (const f of spec.images) await dropImage(old[f]);
      data[payload.collection] = list.filter((x) => x.id !== payload.id);
    }

    try {
      await store.setJSON(KEY, data);
    } catch (e) {
      return cors({ error: "Erreur de sauvegarde: " + e.message }, 500);
    }
    return cors({ success: true, data });
  }

  return cors({ error: "Méthode non supportée." }, 405);
};
