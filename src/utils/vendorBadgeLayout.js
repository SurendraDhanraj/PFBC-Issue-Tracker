import { fmtDay } from './vendors';

// ============================================================================
// Food vendor badge — layout copied from the approved reference design.
//
// The reference is a two-panel card (front on the left, back on the right).
// Every position below is measured from that reference image, in its own pixel
// units (REF_*), and scaled onto the page, so the placement matches exactly.
// ============================================================================

// Reference card extent (pixels in the reference image)
const REF_X0 = 11;
const REF_Y0 = 10;
const REF_W = 995; // 11 -> 1006
const REF_H = 282.5; // 10 -> 292.5

// Page: 5.5 x 8.5 in sheet, landscape (8.5 wide x 5.5 tall); card is centred across the width
export const PAGE_W = 8.5;
export const PAGE_H = 5.5;
const CARD_W = 8.3;
const K = CARD_W / REF_W; // inches per reference pixel
const OX = (PAGE_W - CARD_W) / 2;
const OY = 0.4;

const X = (px) => OX + (px - REF_X0) * K;
const Y = (py) => OY + (py - REF_Y0) * K;
const L = (px) => px * K; // a length

const BLUE = [189, 215, 238]; // #BDD7EE
const FIELD_BORDER = null; // the reference's grey field outlines are not printed (set to [167, 167, 167] to bring them back)
const INK = [0, 0, 0];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}

/** "28th October" and "2027" for the licence expiry (stored as a UTC-midnight date). */
function expiryParts(ms) {
  if (!ms) return { dayMonth: '', year: '' };
  const d = new Date(ms);
  return { dayMonth: `${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`, year: String(d.getUTCFullYear()) };
}

/** Wrap an address onto up to three lines (the district fills a spare line). */
function addressLines(doc, address, district, maxW) {
  const lines = address ? doc.splitTextToSize(String(address), maxW).slice(0, 3) : [];
  if (lines.length < 3 && district) lines.push(district);
  while (lines.length < 3) lines.push('');
  return lines.slice(0, 3);
}

/**
 * Draw the badge onto a jsPDF document that is 8.5 x 5.5 in.
 *   fonts:  { family, hasBold } — a family already registered with the document
 *   images: { logo, sigMoh, sigPhi, photo } — logo and photo are data URLs; the signatures are
 *           { data, w, h } (a transparent PNG as a data URL, with its pixel size) or null
 *   data:   { vendor, licence, districtName, locationName }
 */
export function drawBadge(doc, { fonts, images, data }) {
  const { vendor, licence, districtName, locationName } = data;
  const family = fonts.family;
  const setFont = (bold) => doc.setFont(family, bold ? 'bold' : 'normal');

  const line = (x1, y1, x2, y2, color = INK, w = 1) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(L(w));
    doc.line(X(x1), Y(y1), X(x2), Y(y2));
  };
  const box = (x1, y1, x2, y2, { fill, stroke = FIELD_BORDER, w = 1 } = {}) => {
    if (!fill && !stroke) return; // an unfilled field with no outline draws nothing
    if (fill) doc.setFillColor(...fill);
    if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(L(w)); }
    doc.rect(X(x1), Y(y1), L(x2 - x1), L(y2 - y1), fill && stroke ? 'FD' : fill ? 'F' : 'S');
  };

  /**
   * A signature image ({ data, w, h }) of any shape, scaled to fit the area above its signature
   * line (never stretched), centred across the line and resting on it.
   */
  const drawSignature = (img, x1, y1, x2, y2) => {
    const boxW = L(x2 - x1);
    const boxH = L(y2 - y1);
    const scale = Math.min(boxW / img.w, boxH / img.h);
    const w = img.w * scale;
    const h = img.h * scale;
    doc.addImage(img.data, 'PNG', X(x1) + (boxW - w) / 2, Y(y2) - h, w, h);
  };

  /** Point size at which `sample` is `samplePx` reference pixels wide in this font. */
  const sizeFor = (bold, sample, samplePx) => {
    setFont(bold);
    doc.setFontSize(10);
    return (10 * L(samplePx)) / doc.getTextWidth(sample);
  };

  /**
   * Text at the reference's size for this element, vertically centred on `cy`
   * (reference px). Wide text shrinks to fit `maxPx`.
   */
  const put = (str, { bold = false, sample, samplePx, x, cx, cy, maxPx, color = INK }) => {
    if (!str) return;
    let size = sizeFor(bold, sample, samplePx);
    setFont(bold);
    doc.setFontSize(size);
    if (maxPx) {
      const w = doc.getTextWidth(str);
      if (w > L(maxPx)) { size *= L(maxPx) / w; doc.setFontSize(size); }
    }
    doc.setTextColor(...color);
    if (cx !== undefined) doc.text(str, X(cx), Y(cy), { align: 'center', baseline: 'middle' });
    else doc.text(str, X(x), Y(cy), { baseline: 'middle' });
  };

  const checkbox = (x1, y1, checked) => {
    box(x1, y1, x1 + 15.5, y1 + 15.5, { stroke: INK, w: 1.3 });
    if (checked) {
      doc.setDrawColor(...INK);
      doc.setLineWidth(L(2.6));
      doc.line(X(x1 + 3.2), Y(y1 + 8.2), X(x1 + 6.4), Y(y1 + 11.8));
      doc.line(X(x1 + 6.4), Y(y1 + 11.8), X(x1 + 12.6), Y(y1 + 3.4));
    }
  };

  const type = vendor.vendorType;

  // ---- cut guides: dotted outline round each panel ----
  doc.setLineDashPattern([L(3), L(4)], 0);
  box(11, 10, 505, 292.5, { stroke: [140, 140, 140], w: 1 });
  box(507.5, 10, 1006, 292.5, { stroke: [140, 140, 140], w: 1 });
  doc.setLineDashPattern([], 0);

  // =====================================================================
  // FRONT (left)
  // =====================================================================
  // light-blue panel
  box(16.5, 75, 502.5, 287.5, { fill: BLUE, stroke: null });

  // crest + heading
  box(38, 9, 104, 74);
  if (images.logo) doc.addImage(images.logo, 'PNG', X(40), Y(11), L(62), L(61));
  box(127.5, 19, 487.5, 45);
  box(127.5, 45, 489, 74);
  put('Point Fortin Borough Corporation', { bold: true, sample: 'Point Fortin Borough Corporation', samplePx: 328.5, cx: 307.5, cy: 34 });
  put('Public Health Department', { bold: true, sample: 'Public Health Department', samplePx: 234, cx: 308, cy: 58.5 });

  // photo
  box(44, 83.5, 178.5, 240, { fill: [255, 255, 255] });
  if (images.photo) doc.addImage(images.photo, 'JPEG', X(45), Y(84.5), L(132.5), L(154.5));

  // name
  box(205, 83.5, 488, 112.5, { fill: [255, 255, 255] });
  box(205, 112.5, 488, 134, { fill: [255, 255, 255] });
  put(vendor.vendorName || '', { bold: true, sample: 'VenFirstName', samplePx: 139.5, cx: 346.5, cy: 99, maxPx: 270 });
  put(vendor.vendorSurname || vendor.ownerName || '', { bold: true, sample: 'VenSurname', samplePx: 125.5, cx: 346.5, cy: 124, maxPx: 270 });

  // statement
  const { dayMonth, year } = expiryParts(licence?.expiryDate);
  box(205, 134, 495, 242.5);
  const stmt = [
    'has satisfied the requirements of S 156 (1) h',
    'of the Public Health Ordinance Ch 12 No. 4',
    'and is registered as a Food Handler for the',
    `year ending ${dayMonth}`,
  ];
  const stmtY = [146, 163, 182.5, 201.5];
  const stmtSize = sizeFor(false, stmt[0], 282);
  stmt.forEach((s, i) => {
    setFont(false);
    doc.setFontSize(stmtSize);
    doc.setTextColor(...INK);
    doc.text(s, X(206.5), Y(stmtY[i]), { baseline: 'middle' });
  });
  box(386, 179, 495, 231);
  put(year, { bold: true, sample: '2019', samplePx: 92, cx: 435, cy: 210 });

  // badge number
  box(16.5, 251, 77.5, 286.5);
  put('Badge #', { sample: 'Badge #', samplePx: 55, x: 21, cy: 262.5 });
  box(76, 242.5, 193.5, 284);
  put(vendor.registrationNo || '', { bold: true, sample: 'BadgeNo', samplePx: 101.5, x: 81, cy: 261, maxPx: 108 });

  // Medical Officer of Health signature
  box(226, 227.5, 459, 276.5);
  if (images.sigMoh) drawSignature(images.sigMoh, 228, 222, 457, 264);
  line(207.5, 260, 491, 260, [13, 15, 17], 1.2);
  box(237.5, 262.5, 460, 286);
  put('Medical Officer of Health', { bold: true, sample: 'Medical Officer of Health', samplePx: 204, cx: 342, cy: 271 });

  // =====================================================================
  // BACK (right)
  // =====================================================================
  box(518.5, 18, 992, 45);
  box(518.5, 45, 992, 74);
  put('Point Fortin Borough Corporation', { bold: true, sample: 'Point Fortin Borough Corporation', samplePx: 328, cx: 756, cy: 32 });
  put('Public Health Department', { bold: true, sample: 'Public Health Department', samplePx: 235, cx: 756, cy: 58.5 });

  // vendor type: FE = works within a food establishment, IV = itinerant vendor, SE = special event
  checkbox(520, 76, type === 'establishment');
  box(543, 70, 572, 101);
  put('FE', { sample: 'FE', samplePx: 17.5, x: 546, cy: 84 });
  checkbox(575, 76, type === 'itinerant');
  box(598, 71, 627.5, 102.5);
  put('IV', { sample: 'IV', samplePx: 16, x: 601, cy: 84 });
  checkbox(640, 76, type === 'special_event');
  box(663, 70, 695, 101);
  put('SE', { sample: 'SE', samplePx: 17.5, x: 666, cy: 84 });

  // address
  box(520, 99, 596, 125);
  put('Address', { sample: 'Address', samplePx: 70, x: 522.5, cy: 110 });
  box(597, 98, 987, 125.5);
  box(597, 125.5, 987, 153.5);
  box(597, 153.5, 987, 181);
  const addrSize = sizeFor(false, 'VenAddress1', 116.5);
  setFont(false);
  doc.setFontSize(addrSize);
  const addr = addressLines(doc, vendor.address, districtName, L(380));
  [111, 138, 166].forEach((cy, i) => {
    doc.setTextColor(...INK);
    if (addr[i]) doc.text(addr[i], X(599.5), Y(cy), { baseline: 'middle' });
  });

  // location (business)
  box(518.5, 185, 618.5, 213);
  put('Location', { sample: 'Location', samplePx: 74, x: 520, cy: 199 });
  box(621, 185, 987, 213);
  put(locationName || districtName || '', { bold: true, sample: 'NameBusiness', samplePx: 129.5, x: 623.5, cy: 199.5, maxPx: 360 });

  // date issued
  const issued = licence ? licence.paymentDate || licence.approvedAt : undefined;
  box(520, 237.5, 665, 261.5);
  put(issued ? fmtDay(issued) : '', { sample: 'AppDate', samplePx: 77, cx: 592.5, cy: 251, maxPx: 138 });
  line(518.5, 268.5, 667, 268.5, [13, 15, 17], 1.2);
  box(542, 265, 645, 292.5);
  put('Date Issued', { sample: 'Date Issued', samplePx: 83, cx: 593.5, cy: 276 });

  // Public Health Inspector signature
  box(704.5, 221, 992, 276);
  if (images.sigPhi) drawSignature(images.sigPhi, 708, 219, 990, 268);
  line(711, 265.5, 996, 265.5, [13, 15, 17], 1.2);
  box(742, 265, 965, 290);
  put('Public Health Inspector', { bold: true, sample: 'Public Health Inspector', samplePx: 192, cx: 853.5, cy: 275.5 });
}
