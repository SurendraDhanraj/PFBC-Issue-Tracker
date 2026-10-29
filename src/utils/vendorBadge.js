import { jsPDF } from 'jspdf';
import logoUrl from '../assets/badge/logo.png';
import sigMohUrl from '../assets/badge/sig-moh.png';
import sigPhiUrl from '../assets/badge/sig-phi.png';
import { drawBadge, PAGE_W, PAGE_H } from './vendorBadgeLayout';

// Photo box on the badge is 132.5 x 154.5 reference px
const PHOTO_RATIO = 132.5 / 154.5;

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

async function urlToDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

/** Fetch the vendor's photo and crop it (cover, biased towards the top) to the badge's photo box. */
async function loadPhoto(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (sw / sh > PHOTO_RATIO) sw = Math.round(sh * PHOTO_RATIO);
    else sh = Math.round(sw / PHOTO_RATIO);
    const sx = Math.round((bitmap.width - sw) / 2);
    const sy = Math.round((bitmap.height - sh) * 0.25);
    const canvas = document.createElement('canvas');
    canvas.width = 536; // 4 px per reference px, plenty for print
    canvas.height = Math.round(536 / PHOTO_RATIO);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

// Calibri-compatible font (Carlito, open licence) served from /fonts; cached after the first load.
let fontPromise = null;
function loadFontFiles() {
  if (!fontPromise) {
    const base = `${import.meta.env.BASE_URL || '/'}fonts/`;
    const get = async (name) => {
      const res = await fetch(base + name);
      if (!res.ok) throw new Error(`font ${name} not found`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    fontPromise = Promise.all([get('Carlito-Regular.ttf'), get('Carlito-Bold.ttf')]).catch(() => null);
  }
  return fontPromise;
}

/**
 * Print the vendor's badge as a PDF on a 5.5 x 8.5 in sheet (landscape).
 *   licence: the vendor's current licence (for the expiry year and date issued)
 *   locationName: establishment name / operating area / event, shown as "Location"
 */
export async function generateVendorBadge({ vendor, licence, districtName, locationName, photoUrl }) {
  const [files, logo, sigMoh, sigPhi, photo] = await Promise.all([
    loadFontFiles(),
    urlToDataUrl(logoUrl),
    urlToDataUrl(sigMohUrl),
    urlToDataUrl(sigPhiUrl),
    loadPhoto(photoUrl),
  ]);

  const doc = new jsPDF({ unit: 'in', format: [PAGE_H, PAGE_W], orientation: 'landscape' });
  let family = 'helvetica';
  if (files) {
    doc.addFileToVFS('Carlito-Regular.ttf', files[0]);
    doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
    doc.addFileToVFS('Carlito-Bold.ttf', files[1]);
    doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
    family = 'Carlito';
  }

  drawBadge(doc, {
    fonts: { family },
    images: { logo, sigMoh, sigPhi, photo },
    data: { vendor, licence, districtName, locationName },
  });
  doc.save(`Badge_${vendor.registrationNo}.pdf`);
}
