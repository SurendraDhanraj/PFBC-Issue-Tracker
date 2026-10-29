const MAX_SOURCE_WIDTH = 1600; // large scans/photos are shrunk before processing
const MAX_OUTPUT_WIDTH = 1000;
const INK = [10, 12, 15];

/**
 * Turn a signature photo or scan into a clean transparent PNG:
 *  - the paper colour becomes transparent and only the ink is kept (printed in near-black)
 *  - the image is trimmed to the signature itself
 * A PNG that already has a transparent background is kept as it is (just trimmed).
 * Throws a readable error if the file is not an image or no signature can be found.
 */
export async function prepareSignature(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read. Try a PNG or JPEG.');
  }

  const scale = Math.min(1, MAX_SOURCE_WIDTH / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const n = w * h;

  // Does the image already carry a transparent background?
  let transparent = 0;
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 200) transparent++;
  const hasAlpha = transparent / n > 0.05;

  if (!hasAlpha) {
    // Estimate the paper colour (bright end of the histogram) and map darkness to opacity
    const hist = new Uint32Array(256);
    const lum = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const l = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]);
      lum[i] = l;
      hist[l]++;
    }
    let acc = 0;
    let paper = 255;
    for (let l = 0; l < 256; l++) {
      acc += hist[l];
      if (acc >= n * 0.9) { paper = Math.max(l, 120); break; }
    }
    for (let i = 0; i < n; i++) {
      const d = (paper - lum[i]) / paper; // 0 = paper, 1 = black
      const a = d <= 0.18 ? 0 : Math.min(1, (d - 0.18) / 0.35);
      px[i * 4] = INK[0];
      px[i * 4 + 1] = INK[1];
      px[i * 4 + 2] = INK[2];
      px[i * 4 + 3] = Math.round(a * 255);
    }
  }

  // Trim to the ink
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < 400) {
    throw new Error('No signature found in that image. Sign in dark ink on plain light paper and try again.');
  }
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  ctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  const k = Math.min(1, MAX_OUTPUT_WIDTH / cw);
  out.width = Math.max(1, Math.round(cw * k));
  out.height = Math.max(1, Math.round(ch * k));
  out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);

  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('That image could not be processed.');
  return blob;
}

/** Upload a prepared signature PNG to Convex storage and return its storage id. */
export async function uploadSignatureBlob(generateUrl, blob) {
  const uploadUrl = await generateUrl();
  const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
  if (!res.ok) throw new Error('The signature upload failed. Please try again.');
  const { storageId } = await res.json();
  return storageId;
}
