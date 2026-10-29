import { jsPDF } from 'jspdf';

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

/** Fetch a stored photo as a data URL for the PDF; returns null if it cannot be loaded. */
async function loadPhotoDataUrl(url) {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Printable vendor ID badge on a 5.5 x 8.5 inch page (PDF).
 * `licence` is the vendor's current approved application.
 */
export async function generateVendorBadge({ vendor, licence, districtName, photoUrl }) {
  const photo = await loadPhotoDataUrl(photoUrl);
  const doc = new jsPDF({ unit: 'in', format: [5.5, 8.5] });
  const W = 5.5;
  const cx = W / 2;

  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, W, 8.5, 'F');

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, W, 1.3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('POINT FORTIN BOROUGH CORPORATION', cx, 0.4, { align: 'center' });
  doc.setFontSize(16);
  doc.text('FOOD VENDOR LICENCE', cx, 0.75, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Public Health Department', cx, 1.05, { align: 'center' });

  // Vendor type stripe
  const colours = { itinerant: [124, 58, 237], special_event: [217, 119, 6], establishment: [5, 150, 105] };
  const labels = { itinerant: 'ITINERANT VENDOR', special_event: 'SPECIAL EVENT VENDOR', establishment: 'ESTABLISHMENT VENDOR' };
  const tc = colours[vendor.vendorType] || [100, 100, 100];
  doc.setFillColor(...tc);
  doc.rect(0, 1.3, W, 0.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(labels[vendor.vendorType] || 'FOOD VENDOR', cx, 1.57, { align: 'center' });

  // Photo box with a simple silhouette (no emoji — PDF fonts cannot draw them)
  doc.setDrawColor(200, 200, 205);
  doc.setFillColor(235, 235, 240);
  doc.roundedRect(cx - 0.65, 1.95, 1.3, 1.6, 0.1, 0.1, 'FD');
  if (photo) {
    // photo is already cropped to the same 4:5 shape as the box
    doc.addImage(photo, 'JPEG', cx - 0.65, 1.95, 1.3, 1.6);
    doc.setDrawColor(200, 200, 205);
    doc.roundedRect(cx - 0.65, 1.95, 1.3, 1.6, 0.1, 0.1, 'S');
  } else {
    doc.setFillColor(190, 190, 200);
    doc.circle(cx, 2.55, 0.25, 'F');
    doc.roundedRect(cx - 0.4, 2.85, 0.8, 0.5, 0.2, 0.2, 'F');
    doc.setTextColor(150, 150, 160);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('PHOTO', cx, 3.5, { align: 'center' });
  }

  // Registration number
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(0.5, 3.75, 4.5, 0.45, 0.08, 0.08, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(vendor.registrationNo || '', cx, 4.05, { align: 'center' });

  // Details
  let y = 4.55;
  const row = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text(label, 0.6, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 50);
    const text = doc.splitTextToSize(String(value || '-'), 2.6)[0];
    doc.text(text, 2.3, y);
    doc.setDrawColor(220, 220, 225);
    doc.line(0.6, y + 0.06, 4.9, y + 0.06);
    y += 0.36;
  };
  row('FIRST NAME', vendor.vendorName);
  row('SURNAME', vendor.vendorSurname || vendor.ownerName);
  row('DISTRICT', districtName);
  row('ADDRESS', vendor.address);
  if (vendor.phone) row('PHONE', vendor.phone);
  if (licence?.licenceNo) row('LICENCE NO.', licence.licenceNo);
  if (vendor.vendorType === 'special_event' && vendor.eventName) row('EVENT', vendor.eventName);

  // Validity
  if (licence?.expiryDate) {
    y += 0.15;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(0.5, y - 0.12, 4.5, 0.55, 0.08, 0.08, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text(`VALID: ${fmtDay(licence.approvedAt)}  to  ${fmtDay(licence.expiryDate)}`, cx, y + 0.15, { align: 'center' });
  }

  // Footer
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 7.9, W, 0.6, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 240);
  doc.text('This badge must be displayed at all times while vending.', cx, 8.15, { align: 'center' });
  doc.text('Issued by the Point Fortin Borough Corporation - Public Health Dept.', cx, 8.32, { align: 'center' });

  // Border
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.04);
  doc.rect(0.15, 0.15, 5.2, 8.2);

  doc.save(`Badge_${vendor.registrationNo}.pdf`);
}
