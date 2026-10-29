export const TYPE_LABELS = {
  itinerant: '🚶 Itinerant',
  special_event: '🎪 Special Event',
  establishment: '🏪 Within Establishment',
};

export const TYPE_DESCRIPTIONS = {
  itinerant: 'Moves between locations selling food — annual licence, inspection required.',
  special_event: 'Operates at a specific event — permit lasts at most 30 days.',
  establishment: 'Works within a registered food establishment.',
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

const DAY = 86400000;

/** Dates picked in <input type="date"> are stored as UTC midnight, so show them in UTC. */
export const fmtDay = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Real moments in time (e.g. when an application was opened) show in local time. */
export const fmtMoment = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** 'YYYY-MM-DD' for an <input type="date"> */
export const toDateInput = (ms) => (ms ? new Date(ms).toISOString().split('T')[0] : '');

export const todayInput = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** UTC-midnight timestamp from a 'YYYY-MM-DD' string. */
export const dayToMs = (str) => (str ? new Date(`${str}T00:00:00Z`).getTime() : undefined);

/** Same date one year on, less a day (a licence issued 5 Mar runs to 4 Mar next year). */
export const oneYearOn = (str) => {
  if (!str) return '';
  const d = new Date(`${str}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

export const addDays = (str, n) => {
  if (!str) return '';
  return new Date(new Date(`${str}T00:00:00Z`).getTime() + n * DAY).toISOString().split('T')[0];
};

export const LICENCE_STATE = {
  none: { cls: 'licence-none', text: 'No licence' },
  valid: { cls: 'licence-active', text: 'Licensed' },
  expiring: { cls: 'licence-expiring', text: 'Expiring soon' },
  expired: { cls: 'licence-expired', text: 'Expired' },
};

export function daysLeftText(state, daysLeft) {
  if (state === 'none' || daysLeft == null) return 'No licence on record';
  if (state === 'expired') return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`;
}

/** Vendor photos are stored as 4:5 portrait JPEGs, matching the box on the badge. */
const PHOTO_W = 640;
const PHOTO_H = 800;

/**
 * Centre-crop an image file to 4:5 and re-encode as a JPEG so uploads are small and
 * every photo fits the badge the same way. Throws if the browser cannot read the file.
 */
export async function preparePhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read. Try a JPEG or PNG photo.');
  }
  const targetRatio = PHOTO_W / PHOTO_H;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > targetRatio) sw = Math.round(sh * targetRatio);
  else sh = Math.round(sw / targetRatio);
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('That image could not be processed.');
  return blob;
}

/** Upload a prepared photo to Convex storage and return its storage id. */
export async function uploadPhotoBlob(generateUrl, blob) {
  const uploadUrl = await generateUrl();
  const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  if (!res.ok) throw new Error('The photo upload failed. Please try again.');
  const { storageId } = await res.json();
  return storageId;
}

export const ESTABLISHMENT_TYPES = [
  'Restaurant',
  'Bar / Pub',
  'Bakery',
  'Snackette / Fast food',
  'Supermarket / Grocery',
  'Cafeteria / Canteen',
  'Caterer',
  'Butchery / Fish vendor',
  'Other',
];
