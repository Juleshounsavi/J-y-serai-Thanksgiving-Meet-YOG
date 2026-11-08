'use strict';

/* =========================================================
   J'y serai – Thanksgiving Meet YOG
   Tout se passe dans le navigateur : aucune photo n'est envoyée
   à un serveur.

   Déroulé :
     1. L'utilisateur choisit une photo  -> on la réduit (max 2000 px)
     2. Cropper.js permet de la déplacer / zoomer dans le cadre
     3. On dessine sur un <canvas> 1080×1080 :
          d'abord la photo recadrée, PUIS le gabarit par-dessus
        (le gabarit a un "trou" transparent à l'emplacement du cadre)
     4. On propose Partager / Télécharger
   ========================================================= */

/* ---------- 1. RÉGLAGES (à modifier pour une nouvelle édition) ---------- */
const CONFIG = {
  templateUrl: 'assets/template.png',   // le gabarit avec le trou transparent
  outputSize: 1080,                      // l'affiche finale : 1080 × 1080 px

  // Rectangle où la photo est dessinée, en pixels sur l'affiche 1080×1080.
  // = fenêtre intérieure du cadre (x 330→735, y 228→715) + 4 px de débord de chaque côté.
  // Le débord passe SOUS la bordure orange, donc aucun liseré n'est visible.
  photoArea: { x: 326, y: 224, w: 413, h: 495 },

  maxPhotoSide: 2000,                    // on réduit les grosses photos de téléphone
  maxFileBytes: 30 * 1024 * 1024,        // refuse les fichiers > 30 Mo
  jpegQuality: 0.92,
  downloadName: 'jyserai-thanksgiving-meet-yog.jpg',

  // Date de l'événement : 06/12/2026 à 14h30 GMT (en JS, les mois commencent à 0 : 11 = décembre)
  eventDay: Date.UTC(2026, 11, 6),

  shareTitle: "J'y serai – Thanksgiving Meet YOG",
  shareText:
    "Je serai au Thanksgiving Meet YOG\n" +
    "📅 Dimanche 06.12.26 à 14h30 GMT\n" +
    "📍 Jardin public 2 Février\n" +
    "Thème : The life\n" +
    "Viens prier, louer Dieu et partager un repas avec nous !\n" +
    "#ThanksgivingMeet #YOG #JySerai",
};

/* ---------- 2. RACCOURCIS VERS LES ÉLÉMENTS DE LA PAGE ---------- */
const $ = (id) => document.getElementById(id);

const stepEls = { 1: $('step-photo'), 2: $('step-crop'), 3: $('step-result') };
const dotEls = { 1: $('dot-1'), 2: $('dot-2'), 3: $('dot-3') };
const statusEl = $('status');

const photoInput = $('photo-input');
const dropzone = $('dropzone');
const cropImage = $('crop-image');
const zoomRange = $('zoom-range');
const resultImage = $('result-image');
const btnGenerate = $('btn-generate');
const btnShare = $('btn-share');
const btnDownload = $('btn-download');

/* ---------- 3. ÉTAT (ce dont l'appli se souvient) ---------- */
let cropper = null;          // l'instance Cropper.js
let minRatio = 1;            // zoom minimum (photo qui remplit juste le cadre)
let cropUrl = null;          // adresse temporaire de la photo réduite
let resultUrl = null;        // adresse temporaire de l'affiche finale
let resultFile = null;       // l'affiche finale sous forme de fichier (pour partager)
let busy = false;

/* ---------- 4. OUTILS ---------- */

// Libère la mémoire d'une adresse temporaire (blob:)
function revoke(url) { if (url) URL.revokeObjectURL(url); }

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}
function clearStatus() {
  statusEl.textContent = '';
  statusEl.hidden = true;
}

// Passe d'une étape à l'autre : affiche l'une, cache les autres, met à jour l'indicateur
function goTo(step) {
  for (const n of [1, 2, 3]) {
    stepEls[n].hidden = n !== step;
    dotEls[n].classList.toggle('is-current', n === step);
    dotEls[n].classList.toggle('is-done', n < step);
    if (n === step) dotEls[n].setAttribute('aria-current', 'step');
    else dotEls[n].removeAttribute('aria-current');
  }
  clearStatus();
  // On place le focus sur le titre de l'étape (utile aux lecteurs d'écran et au clavier)
  const title = stepEls[step].querySelector('.step-title');
  if (title) title.focus({ preventScroll: true });
  // Sur mobile, on remonte en haut de l'outil pour voir la nouvelle étape
  $('titre-outil').parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// canvas.toBlob() version "promesse"
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob a échoué'))), type, quality);
  });
}

// Charge une image via une balise <img> (solution de secours)
function loadWithImgTag(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { revoke(url); resolve(img); };
    img.onerror = () => { revoke(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

/* ---------- 5. ÉTAPE 1 : lire et réduire la photo ---------- */

// Retourne un <canvas> contenant la photo, remise à l'endroit et réduite à 2000 px max.
async function fileToCanvas(file) {
  let source;
  try {
    // 'from-image' = applique l'orientation EXIF (évite les photos "couchées" des téléphones)
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    // Vieux navigateurs : on passe par une balise <img> (qui applique l'EXIF toute seule)
    source = await loadWithImgTag(file);
  }

  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  const scale = Math.min(1, CONFIG.maxPhotoSide / Math.max(srcW, srcH));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';                       // évite un fond noir pour les PNG transparents
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();             // libère la mémoire de l'ImageBitmap
  return canvas;
}

async function handleFile(file) {
  if (!file || busy) return;

  if (!file.type.startsWith('image/')) {
    showStatus("Ce fichier n'est pas une image. Choisis une photo (JPEG, PNG, WebP…).");
    return;
  }
  if (file.size > CONFIG.maxFileBytes) {
    showStatus('Cette photo est trop lourde (30 Mo maximum). Choisis-en une plus légère.');
    return;
  }

  busy = true;
  clearStatus();
  try {
    const canvas = await fileToCanvas(file);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    revoke(cropUrl);
    cropUrl = URL.createObjectURL(blob);
    startCropper(cropUrl);
  } catch (err) {
    console.error(err);
    showStatus(
      "Impossible de lire cette photo. Essaie une photo JPEG ou PNG. " +
      "Sur iPhone : Réglages > Appareil photo > Formats > « Le plus compatible »."
    );
  } finally {
    busy = false;
    photoInput.value = '';     // permet de re-choisir la même photo plus tard
  }
}

/* ---------- 6. ÉTAPE 2 : recadrage avec Cropper.js ---------- */

function destroyCropper() {
  if (cropper) { cropper.destroy(); cropper = null; }
}

function startCropper(url) {
  destroyCropper();
  goTo(2);                                     // on affiche l'étape AVANT d'initialiser (Cropper mesure son conteneur)

  cropImage.addEventListener('load', () => {
    cropper = new Cropper(cropImage, {
      aspectRatio: CONFIG.photoArea.w / CONFIG.photoArea.h,   // même forme que le cadre de l'affiche
      viewMode: 3,                    // la photo remplit toujours le cadre : jamais de bande vide
      dragMode: 'move',               // on déplace la photo, pas le cadre
      autoCropArea: 1,                // le cadre de découpe occupe tout l'espace
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      guides: false,
      center: false,
      highlight: false,
      background: false,
      checkOrientation: false,        // déjà corrigée à l'étape 1
      ready() {
        // Zoom de départ = zoom minimum. Le curseur va de 1× (minimum) à 4×.
        const c = cropper.getCanvasData();
        minRatio = c.width / c.naturalWidth;
        zoomRange.value = 1;
      },
      zoom(e) {
        // Quand l'utilisateur pince ou utilise la molette, on déplace le curseur
        zoomRange.value = Math.min(4, Math.max(1, e.detail.ratio / minRatio));
      },
    });
  }, { once: true });

  cropImage.src = url;
}

// Le curseur de zoom pilote Cropper
zoomRange.addEventListener('input', () => {
  if (cropper) cropper.zoomTo(minRatio * Number(zoomRange.value));
});

/* ---------- 7. ÉTAPE 3 : fabriquer l'affiche ---------- */

// Le gabarit est chargé une seule fois, au démarrage
const templateImg = new Image();
const templateReady = new Promise((resolve, reject) => {
  templateImg.onload = resolve;
  templateImg.onerror = () => reject(new Error('Gabarit introuvable'));
});
templateImg.src = CONFIG.templateUrl;

async function buildPoster() {
  await templateReady;
  const { x, y, w, h } = CONFIG.photoArea;
  const size = CONFIG.outputSize;

  // La partie de la photo choisie par l'utilisateur, à la taille exacte de la fenêtre
  const photo = cropper.getCroppedCanvas({
    width: w,
    height: h,
    fillColor: '#fff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(photo, x, y, w, h);            // 1) la photo (en dessous)
  ctx.drawImage(templateImg, 0, 0, size, size); // 2) le gabarit par-dessus : cadre, textes, décor

  return canvasToBlob(out, 'image/jpeg', CONFIG.jpegQuality);
}

btnGenerate.addEventListener('click', async () => {
  if (!cropper || busy) return;
  busy = true;
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Création en cours…';
  try {
    const blob = await buildPoster();
    revoke(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultFile = new File([blob], CONFIG.downloadName, { type: 'image/jpeg' });

    resultImage.src = resultUrl;               // <img> : permet l'appui long pour enregistrer
    btnDownload.href = resultUrl;
    btnDownload.download = CONFIG.downloadName;
    goTo(3);
  } catch (err) {
    console.error(err);
    showStatus("Oups, la création de l'affiche a échoué. Réessaie ou choisis une autre photo.");
  } finally {
    busy = false;
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Voir mon affiche';
  }
});

/* ---------- 8. PARTAGER / TÉLÉCHARGER / COPIER ---------- */

// Le bouton "Partager" n'apparaît que si le navigateur sait partager un fichier image
// (c'est le cas sur la plupart des téléphones, pas sur la plupart des ordinateurs).
function canShareFiles() {
  try {
    const test = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    return !!(navigator.canShare && navigator.canShare({ files: [test] }));
  } catch (e) {
    return false;
  }
}
btnShare.hidden = !canShareFiles();

btnShare.addEventListener('click', async () => {
  if (!resultFile) return;
  try {
    await navigator.share({
      files: [resultFile],
      title: CONFIG.shareTitle,
      text: CONFIG.shareText,
    });
  } catch (err) {
    // AbortError = l'utilisateur a fermé la fenêtre de partage : ce n'est pas une erreur
    if (err && err.name !== 'AbortError') {
      showStatus("Le partage n'a pas fonctionné. Utilise « Télécharger l'image » à la place.");
    }
  }
});

// Navigateurs intégrés aux applis (Instagram, Facebook, TikTok…) : le téléchargement y est souvent bloqué
if (/FBAN|FBAV|Instagram|musical_ly|TikTok|Line\/|MicroMessenger|Snapchat/i.test(navigator.userAgent)) {
  $('inapp-warning').hidden = false;
}

// Texte à publier avec l'affiche
const captionText = $('caption-text');
captionText.value = CONFIG.shareText;

$('btn-copy').addEventListener('click', async (e) => {
  const button = e.currentTarget;
  try {
    await navigator.clipboard.writeText(CONFIG.shareText);
  } catch (err) {
    // Secours : sélectionner le texte et copier à l'ancienne
    captionText.focus();
    captionText.select();
    document.execCommand('copy');
  }
  const original = button.textContent;
  button.textContent = 'Copié ✓';
  setTimeout(() => { button.textContent = original; }, 2000);
});

/* ---------- 9. BOUTONS DE NAVIGATION ---------- */
$('btn-change-photo').addEventListener('click', () => { destroyCropper(); goTo(1); });
$('btn-edit-crop').addEventListener('click', () => goTo(2));
$('btn-restart').addEventListener('click', () => {
  destroyCropper();
  revoke(cropUrl); cropUrl = null;
  revoke(resultUrl); resultUrl = null; resultFile = null;
  resultImage.removeAttribute('src');
  goTo(1);
});

/* ---------- 10. CHOIX DE LA PHOTO (bouton + glisser-déposer) ---------- */
photoInput.addEventListener('change', () => handleFile(photoInput.files[0]));

['dragenter', 'dragover'].forEach((type) =>
  dropzone.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.add('is-over'); })
);
['dragleave', 'drop'].forEach((type) =>
  dropzone.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.remove('is-over'); })
);
dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

/* ---------- 11. DÉTAILS : compte à rebours et année ---------- */
(function renderCountdown() {
  const el = $('countdown');
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((CONFIG.eventDay - today) / 86400000);
  if (days < 0) return;                         // événement passé : on n'affiche rien
  el.textContent = days === 0 ? "C'est aujourd'hui !" : days === 1 ? "C'est demain !" : `Plus que ${days} jours !`;
  el.hidden = false;
})();

$('year').textContent = new Date().getFullYear();
