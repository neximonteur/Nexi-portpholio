# Nexi Monteur — Portfolio

Ton site est prêt. Voici comment le mettre en ligne, étape par étape.

## Ce que contient ce dossier

- `index.html` — la page du site
- `app.js` — toute la logique (affichage, filtres, admin)
- `netlify/functions/videos.js` — le "serveur" qui sauvegarde tes vidéos
- `netlify.toml` — la configuration
- `package.json` — la dépendance nécessaire

## Étape 1 — Créer un compte Netlify (gratuit)

Va sur https://www.netlify.com et crée un compte (tu peux utiliser ton compte Google directement).

## Étape 2 — Mettre le projet sur GitHub

Netlify a besoin que ton projet soit sur GitHub pour le déployer.

1. Crée un compte sur https://github.com si tu n'en as pas
2. Crée un nouveau "repository" (bouton vert "New")
3. Nomme-le par exemple `nexi-monteur-portfolio`
4. Une fois créé, GitHub te propose d'uploader des fichiers ("uploading an existing file") — glisse tout le contenu de ce dossier dedans (y compris le dossier `netlify` en entier)
5. Clique sur "Commit changes"

## Étape 3 — Connecter GitHub à Netlify

1. Sur Netlify, clique sur "Add new site" → "Import an existing project"
2. Choisis GitHub, autorise l'accès, puis sélectionne ton repository `nexi-monteur-portfolio`
3. Netlify détecte automatiquement la configuration grâce au fichier `netlify.toml` — tu peux laisser les réglages par défaut
4. Clique sur "Deploy"

Après 1-2 minutes, ton site est en ligne sur une adresse du type `https://nom-aleatoire.netlify.app`.

## Étape 4 — Sécuriser ton mot de passe admin (important)

Par défaut le mot de passe est `Lupabe36`, écrit dans le code. Pour plus de sécurité, mets-le plutôt en variable d'environnement :

1. Dans Netlify, va dans ton site → "Site configuration" → "Environment variables"
2. Ajoute une variable : nom `ADMIN_PASSWORD`, valeur `Lupabe36` (ou un autre mot de passe de ton choix)
3. Redéploie le site (Netlify → "Deploys" → "Trigger deploy")

## Étape 5 — Relier ton propre nom de domaine

1. Achète un nom de domaine (Namecheap, OVH, Google Domains, etc. — environ 10€/an)
2. Dans Netlify : ton site → "Domain management" → "Add a domain"
3. Netlify t'indique les enregistrements DNS à mettre chez ton registrar (généralement un enregistrement de type A ou CNAME)
4. Une fois configuré, ça prend entre quelques minutes et quelques heures pour se propager

## Étape 6 — Référencement Google

Une fois le site en ligne avec ton domaine :
1. Va sur Google Search Console (https://search.google.com/search-console)
2. Ajoute ta propriété (ton nom de domaine)
3. Vérifie la propriété (Netlify permet d'ajouter facilement l'enregistrement DNS de vérification demandé)
4. Demande l'indexation de ta page d'accueil

Google indexera ton site en quelques jours à quelques semaines.

## Accès au menu admin (une fois le site en ligne)

- Clique 5 fois rapidement sur le logo "Nexi Monteur" en haut à gauche, OU tape le mot `admin` au clavier n'importe où sur la page
- Mot de passe : celui que tu as défini à l'étape 4

## Besoin d'aide au déploiement ?

Chaque étape ci-dessus peut être refaite avec moi si tu bloques quelque part — dis-moi simplement à quelle étape tu es et ce que tu vois à l'écran.
