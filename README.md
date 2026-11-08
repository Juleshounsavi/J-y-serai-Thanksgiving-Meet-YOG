# J'y serai – Thanksgiving Meet YOG

Site statique (HTML + CSS + JavaScript, sans serveur ni base de données) qui permet à chacun de
créer son affiche « J'y serai » : choisir une photo, la recadrer, télécharger ou partager l'image.
Toute la fabrication de l'image se fait dans le navigateur : les photos ne sont jamais envoyées.

## Structure

```
index.html               page principale (les 3 étapes)
css/style.css            tout le style (couleurs de l'affiche, mobile first)
js/app.js                toute la logique (upload, recadrage, génération)
assets/template.png      gabarit 1080×1080 avec une fenêtre transparente à la place du paysage
assets/                  logo, icônes, image d'aperçu des réseaux (og.jpg)
vendor/cropperjs/        bibliothèque de recadrage Cropper.js (copie locale)
fonts/                   polices Montserrat et Mrs Saint Delafield (copie locale)
vercel.json              en-têtes de sécurité, URLs propres, cache
```
