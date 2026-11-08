# J'y serai – Thanksgiving Meet YOG

Site statique (HTML + CSS + JavaScript, sans serveur ni base de données) qui permet à chacun de
créer son affiche « J'y serai » : choisir une photo, la recadrer, télécharger ou partager l'image.
Toute la fabrication de l'image se fait dans le navigateur : les photos ne sont jamais envoyées.

## Structure

```
index.html               page principale (les 3 étapes)
mentions-legales.html    mentions légales (à compléter)
confidentialite.html     politique de confidentialité (à compléter)
css/style.css            tout le style (couleurs de l'affiche, mobile first)
js/app.js                toute la logique (upload, recadrage, génération)
assets/template.png      gabarit 1080×1080 avec une fenêtre transparente à la place du paysage
assets/                  logo, icônes, image d'aperçu des réseaux (og.jpg)
vendor/cropperjs/        bibliothèque de recadrage Cropper.js (copie locale)
fonts/                   polices Montserrat et Mrs Saint Delafield (copie locale)
vercel.json              en-têtes de sécurité, URLs propres, cache
```

## Tester en local

Dans VS Code, installe l'extension **Live Server**, puis clic droit sur `index.html` >
« Open with Live Server ». (Ou, avec Node : `npx serve .` dans le dossier.)
Ouvre le fichier directement par double-clic ne marche pas bien : il faut un petit serveur local.

## Déployer sur Vercel

1. Crée un dépôt GitHub et envoie-y le contenu du dossier (`git init`, `git add .`, `git commit`, `git push`).
2. Sur vercel.com : **Add New… > Project**, importe le dépôt.
3. Réglages : **Framework Preset = Other**, laisse **Build Command** et **Output Directory** vides, clique **Deploy**.
4. Une adresse `xxx.vercel.app` est créée. À chaque `git push`, le site se met à jour tout seul.
5. Mets à jour dans `index.html` la ligne `og:image` avec ton vrai domaine (aperçu WhatsApp/Facebook).

Alternative sans GitHub : `npm i -g vercel`, puis `vercel` dans le dossier (et `vercel --prod` pour publier).

## Avant de mettre en ligne : compléter les pages légales

Dans VS Code, fais **Ctrl+Maj+F** et cherche `À COMPLÉTER` puis `À VÉRIFIER` : chaque zone jaune
des deux pages légales doit être remplie (nom de l'association, adresse, téléphone, e-mail,
directeur de la publication, téléphone de l'hébergeur). Cherche aussi `VOTRE-DOMAINE`.

## Préparer l'édition suivante

1. Exporte la nouvelle affiche en 1080×1080 et rends la fenêtre photo transparente (voir `assets/template.png`).
2. Si le cadre change de place, mets à jour `photoArea` dans `js/app.js` (x, y, largeur, hauteur en pixels).
3. Mets à jour la date (`eventDay`) et le texte (`shareText`) dans `js/app.js`, ainsi que le bloc de l'événement dans `index.html`.
