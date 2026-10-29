import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Food vendors — registration, annual licence, renewals
//
// Rules implemented here:
//  - Registration numbers are auto-generated: FV-YYYY-NNNN
//  - Vendor types: itinerant | special_event | establishment
//  - Licence numbers are entered manually and must be unique across
//    vendor AND establishment licences
//  - Payment is tracked manually (no online payments)
//  - Licences run one year; renewals open 30 days before expiry
//  - Itinerant vendors must be inspected before a licence is issued
//  - Special event permits last at most 30 days
//  - Every application/renewal is kept as history against the vendor
// ============================================================

const DAY = 86_400_000;
const RENEWAL_WINDOW_DAYS = 30;
const VENDOR_STATUSES = ["active", "pending", "suspended", "expired", "revoked"];
const WRITE_FALLBACK_ROLES = [
  "Medical Officer of Health",
  "Public Health Inspector III",
  "Public Health Inspector II",
  "Sanitation Foreman III",
];

const vendorTypeValidator = v.union(
  v.literal("itinerant"),
  v.literal("special_event"),
  v.literal("establishment")
);

// ---------- helpers ----------

async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

/** Write access to the food vendor module (role permissions, with a sensible fallback). */
async function getWriter(ctx: any, token: string) {
  const user = await getSessionUser(ctx, token);
  if (!user) return null;
  const roleDoc = await ctx.db
    .query("roles")
    .withIndex("by_name", (q: any) => q.eq("name", user.role))
    .first();
  const level = roleDoc?.permissions?.foodVendors;
  const allowed = level
    ? level === "write" || level === "admin"
    : WRITE_FALLBACK_ROLES.includes(user.role);
  return allowed ? user : null;
}

type LicenceState = "none" | "valid" | "expiring" | "expired";

/** Work out the vendor's current licence from its application history. */
function licenceInfo(apps: any[], now: number) {
  const approved = apps
    .filter((a) => a.status === "approved" && a.expiryDate)
    .sort((a, b) => b.expiryDate - a.expiryDate);
  const current = approved[0];
  const open = apps.find((a) => a.status === "submitted" || a.status === "under_review");
  let state: LicenceState = "none";
  let daysLeft: number | undefined;
  if (current) {
    // A licence is valid through the whole of its expiry day.
    daysLeft = Math.floor((current.expiryDate - now) / DAY) + 1;
    state = daysLeft < 0 ? "expired" : daysLeft <= RENEWAL_WINDOW_DAYS ? "expiring" : "valid";
  }
  return { current, open, state, daysLeft };
}

/** The status shown to staff: a vendor whose licence has lapsed reads as expired (suspended and revoked are deliberate decisions and always show as they are). */
function displayStatus(vendor: any, state: LicenceState) {
  const status = vendor.status || "pending";
  if ((status === "active" || status === "pending") && state === "expired") return "expired";
  return status;
}

function durationDays(start: number, end: number) {
  return (end - start) / DAY;
}

function validateEventDates(start?: number, end?: number): string | null {
  if (!start || !end) return "Special event vendors must provide event start and end dates";
  if (end < start) return "Event end date must be after start date";
  if (durationDays(start, end) > 30) return "Special event permit cannot exceed 30 days";
  return null;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Check an uploaded file really is a reasonably sized image. Returns an error message, or null if fine. */
async function photoProblem(ctx: any, storageId: any): Promise<string | null> {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) return "The uploaded photo could not be found";
  if (!String(meta.contentType || "").startsWith("image/")) return "The photo must be an image file";
  if (meta.size > MAX_PHOTO_BYTES) return "The photo is too large (maximum 5 MB)";
  return null;
}

async function nextRegistrationNo(ctx: any, year: number) {
  const prefix = `FV-${year}-`;
  const last = await ctx.db
    .query("foodVendors")
    .withIndex("by_reg_no", (q: any) => q.gte("registrationNo", prefix).lt("registrationNo", prefix + "\uffff"))
    .order("desc")
    .first();
  const lastNum = last ? parseInt(String(last.registrationNo).slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ---------- queries ----------

export const listVendors = query({
  args: {
    token: v.string(),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    vendorType: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    // none | valid | expiring | expired | open_application
    licence: v.optional(v.string()),
  },
  handler: async (ctx, { token, search, status, vendorType, districtId, licence }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return [];
    const now = Date.now();

    let vendors = await ctx.db.query("foodVendors").order("desc").collect();
    if (districtId) vendors = vendors.filter((x: any) => x.districtId === districtId);
    if (vendorType) vendors = vendors.filter((x: any) => x.vendorType === vendorType);
    if (search) {
      const s = search.trim().toLowerCase();
      vendors = vendors.filter(
        (x: any) =>
          (x.vendorName || "").toLowerCase().includes(s) ||
          (x.vendorSurname || x.ownerName || "").toLowerCase().includes(s) ||
          (x.registrationNo || "").toLowerCase().includes(s)
      );
    }

    const rows = await Promise.all(
      vendors.map(async (vendor: any) => {
        const apps = await ctx.db
          .query("vendorApplications")
          .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendor._id))
          .collect();
        const info = licenceInfo(apps, now);
        let linkedEstablishmentName: string | undefined;
        if (vendor.linkedEstablishmentId) {
          const estab = await ctx.db.get(vendor.linkedEstablishmentId);
          linkedEstablishmentName = estab?.establishmentName;
        }
        return {
          ...vendor,
          displayStatus: displayStatus(vendor, info.state),
          licenceState: info.state,
          daysLeft: info.daysLeft,
          currentLicenceNo: info.current?.licenceNo,
          licenceExpiry: info.current?.expiryDate,
          hasOpenApplication: !!info.open,
          linkedEstablishmentName,
          photoUrl: vendor.photoStorageId ? await ctx.storage.getUrl(vendor.photoStorageId) : null,
        };
      })
    );

    return rows.filter((r: any) => {
      if (status && r.displayStatus !== status) return false;
      if (licence === "open_application") return r.hasOpenApplication;
      if (licence && r.licenceState !== licence) return false;
      return true;
    });
  },
});

export const getVendor = query({
  args: { token: v.string(), vendorId: v.id("foodVendors") },
  handler: async (ctx, { token, vendorId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return null;
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return null;
    const now = Date.now();

    const apps = await ctx.db
      .query("vendorApplications")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
      .collect();
    apps.sort((a: any, b: any) => (b.applicationDate || 0) - (a.applicationDate || 0));

    const names: Record<string, string> = {};
    const nameOf = async (id?: any) => {
      if (!id) return undefined;
      if (!(id in names)) {
        const u = await ctx.db.get(id);
        names[id] = u?.name || "—";
      }
      return names[id];
    };
    const history = await Promise.all(
      apps.map(async (a: any) => ({
        ...a,
        approvedByName: await nameOf(a.approvedBy),
        inspectedByName: await nameOf(a.inspectedBy),
      }))
    );

    const info = licenceInfo(apps, now);
    const renewalOpensAt = info.current ? info.current.expiryDate - RENEWAL_WINDOW_DAYS * DAY : undefined;
    // A new application is allowed when nothing is open and the licence is missing,
    // inside the 30-day renewal window, or already expired.
    const canApply = !info.open && (info.state === "none" || info.state === "expiring" || info.state === "expired");

    let linkedEstablishment: any = undefined;
    if (vendor.linkedEstablishmentId) linkedEstablishment = await ctx.db.get(vendor.linkedEstablishmentId);

    return {
      vendor: {
        ...vendor,
        displayStatus: displayStatus(vendor, info.state),
        photoUrl: vendor.photoStorageId ? await ctx.storage.getUrl(vendor.photoStorageId) : null,
      },
      applications: history,
      currentLicence: (info.current && history.find((h: any) => h._id === info.current._id)) || null,
      licenceState: info.state,
      daysLeft: info.daysLeft,
      openApplication: info.open || null,
      renewalOpensAt,
      canApply,
      linkedEstablishment,
    };
  },
});

// ---------- vendor mutations ----------

export const createVendor = mutation({
  args: {
    token: v.string(),
    vendorName: v.string(),
    vendorSurname: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    vendorType: vendorTypeValidator,
    linkedEstablishmentId: v.optional(v.id("foodEstablishments")),
    eventName: v.optional(v.string()),
    eventStartDate: v.optional(v.number()),
    eventEndDate: v.optional(v.number()),
    operatingArea: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { token, ...data }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to register vendors" };

    if (data.photoStorageId) {
      const problem = await photoProblem(ctx, data.photoStorageId);
      if (problem) return { success: false, error: problem };
    }
    if (!data.vendorName.trim() || !data.vendorSurname.trim() || !data.address.trim()) {
      return { success: false, error: "First name, surname and address are required" };
    }

    if (data.vendorType === "establishment") {
      if (!data.linkedEstablishmentId) return { success: false, error: "Select the food establishment this vendor works within" };
      const estab = await ctx.db.get(data.linkedEstablishmentId);
      if (!estab) return { success: false, error: "Linked establishment not found" };
    } else {
      data.linkedEstablishmentId = undefined;
    }

    if (data.vendorType === "special_event") {
      if (!data.eventName?.trim()) return { success: false, error: "Special event vendors must provide an event name" };
      const err = validateEventDates(data.eventStartDate, data.eventEndDate);
      if (err) return { success: false, error: err };
    } else {
      data.eventName = undefined;
      data.eventStartDate = undefined;
      data.eventEndDate = undefined;
    }
    if (data.vendorType !== "itinerant") data.operatingArea = undefined;

    const now = Date.now();
    const year = new Date(now).getFullYear();
    const registrationNo = await nextRegistrationNo(ctx, year);

    const doc: any = {
      ...data,
      vendorName: data.vendorName.trim(),
      vendorSurname: data.vendorSurname.trim(),
      address: data.address.trim(),
      registrationNo,
      registrationDate: now,
      status: "pending",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    };
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);
    const id = await ctx.db.insert("foodVendors", doc);

    // First licence application is opened with the registration.
    await ctx.db.insert("vendorApplications", {
      vendorId: id,
      year,
      applicationDate: now,
      status: "submitted",
      feePaid: false,
      createdBy: user._id,
      createdAt: now,
    });

    return { success: true, id, registrationNo };
  },
});

export const updateVendor = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    vendorName: v.optional(v.string()),
    vendorSurname: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    status: v.optional(v.string()),
    linkedEstablishmentId: v.optional(v.id("foodEstablishments")),
    eventName: v.optional(v.string()),
    eventStartDate: v.optional(v.number()),
    eventEndDate: v.optional(v.number()),
    operatingArea: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, ...updates }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to edit vendors" };
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };

    if (updates.status !== undefined) {
      if (!VENDOR_STATUSES.includes(updates.status)) return { success: false, error: "Invalid status" };
      if (updates.status === "active") {
        const apps = await ctx.db
          .query("vendorApplications")
          .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
          .collect();
        const info = licenceInfo(apps, Date.now());
        if (info.state === "none" || info.state === "expired") {
          return { success: false, error: "A vendor can only be active while it holds a valid licence" };
        }
      }
    }

    if (vendor.vendorType === "special_event" && (updates.eventStartDate || updates.eventEndDate)) {
      const err = validateEventDates(
        updates.eventStartDate ?? vendor.eventStartDate,
        updates.eventEndDate ?? vendor.eventEndDate
      );
      if (err) return { success: false, error: err };
    }

    if (updates.linkedEstablishmentId) {
      const estab = await ctx.db.get(updates.linkedEstablishmentId);
      if (!estab) return { success: false, error: "Linked establishment not found" };
    }

    const patch: any = { ...updates, updatedAt: Date.now() };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(vendorId, patch);
    return { success: true };
  },
});

// ---------- licence workflow ----------

/** Open a new application — the first licence, or a renewal inside the 30-day window. */
export const startApplication = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    fee: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, fee, notes }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };

    const now = Date.now();
    const apps = await ctx.db
      .query("vendorApplications")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
      .collect();
    const info = licenceInfo(apps, now);

    if (info.open) return { success: false, error: "There is already an open application for this vendor" };
    if (info.state === "valid" && info.current) {
      const opens = new Date(info.current.expiryDate - RENEWAL_WINDOW_DAYS * DAY).toLocaleDateString("en-GB");
      return { success: false, error: `Renewal opens ${RENEWAL_WINDOW_DAYS} days before expiry, on ${opens}` };
    }

    const id = await ctx.db.insert("vendorApplications", {
      vendorId,
      year: new Date(now).getFullYear(),
      applicationDate: now,
      status: "submitted",
      fee,
      feePaid: false,
      notes,
      createdBy: user._id,
      createdAt: now,
    });
    return { success: true, id };
  },
});

/** Record the inspection for an open application. */
export const recordInspection = mutation({
  args: {
    token: v.string(),
    appId: v.id("vendorApplications"),
    inspectionDate: v.number(),
    inspectionNotes: v.optional(v.string()),
  },
  handler: async (ctx, { token, appId, inspectionDate, inspectionNotes }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const app = await ctx.db.get(appId);
    if (!app) return { success: false, error: "Application not found" };
    if (app.status !== "submitted" && app.status !== "under_review") {
      return { success: false, error: "This application is already closed" };
    }
    await ctx.db.patch(appId, {
      status: "under_review",
      inspectionDate,
      inspectedBy: user._id,
      inspectionNotes: inspectionNotes || undefined,
    });
    return { success: true };
  },
});

// ---------- licence validity (calculated from the payment, never typed in) ----------

/** Same calendar date one year on, less a day: starting 5 Mar 2026 -> valid to 4 Mar 2027. */
function oneYearTerm(start: number) {
  const d = new Date(start);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime() - DAY;
}

/**
 * Work out the licence period for a payment made on `paymentDate`.
 *  - Special event permits cover the event dates.
 *  - Annual licences run one year from the payment date. When a renewal is paid on or
 *    before the old licence's expiry, the new year starts the day after it, so no paid
 *    time is lost. A lapsed licence restarts from the payment date.
 */
function computeValidity(vendor: any, apps: any[], paymentDate: number) {
  if (vendor.vendorType === "special_event") {
    if (!vendor.eventStartDate || !vendor.eventEndDate) {
      return { error: "Set the event dates on the vendor before recording payment" };
    }
    if (vendor.eventEndDate < paymentDate) return { error: "The event has already ended" };
    return { start: vendor.eventStartDate as number, end: vendor.eventEndDate as number, basis: "event" };
  }
  const previous = apps
    .filter((a) => a.status === "approved" && a.expiryDate)
    .sort((a, b) => b.expiryDate - a.expiryDate)[0];
  if (previous && previous.expiryDate >= paymentDate) {
    const start = previous.expiryDate + DAY;
    return { start, end: oneYearTerm(start), basis: "continues_previous", previousExpiry: previous.expiryDate as number };
  }
  return { start: paymentDate, end: oneYearTerm(paymentDate), basis: "payment_date" };
}

/** Licence numbers are unique per holder: one vendor may keep its own number across renewals,
 *  but no other vendor or establishment may use it. */
async function licenceNoConflict(ctx: any, no: string, vendorId: any, exceptAppId?: any): Promise<string | null> {
  const vendorUses = await ctx.db
    .query("vendorApplications")
    .withIndex("by_licence", (q: any) => q.eq("licenceNo", no))
    .collect();
  if (vendorUses.some((a: any) => a._id !== exceptAppId && a.vendorId !== vendorId)) {
    return `Licence number "${no}" is already in use`;
  }
  const estabUse = await ctx.db
    .query("establishmentApplications")
    .withIndex("by_licence", (q: any) => q.eq("licenceNo", no))
    .first();
  if (estabUse) return `Licence number "${no}" is already in use by an establishment`;
  return null;
}

/** What validity period would a payment on this date give? (Shown before the payment is saved.) */
export const previewValidity = query({
  args: { token: v.string(), vendorId: v.id("foodVendors"), paymentDate: v.number() },
  handler: async (ctx, { token, vendorId, paymentDate }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return null;
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return null;
    const apps = await ctx.db
      .query("vendorApplications")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
      .collect();
    return computeValidity(vendor, apps, paymentDate);
  },
});

/**
 * Record the payment and update the licence: the licence number is entered manually and the
 * validity period is set automatically from the payment (see computeValidity).
 */
export const issueLicence = mutation({
  args: {
    token: v.string(),
    appId: v.id("vendorApplications"),
    licenceNo: v.string(),
    fee: v.number(),
    paymentDate: v.number(),
    paymentMethod: v.string(), // cash | cheque | bank_transfer | other
    receiptNo: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, appId, licenceNo, fee, paymentDate, paymentMethod, receiptNo, notes }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to record payments" };

    const app = await ctx.db.get(appId);
    if (!app) return { success: false, error: "Application not found" };
    if (app.status !== "submitted" && app.status !== "under_review") {
      return { success: false, error: "This application is already closed" };
    }
    const vendor = await ctx.db.get(app.vendorId as any);
    if (!vendor) return { success: false, error: "Vendor not found" };

    const no = licenceNo.trim();
    if (!no) return { success: false, error: "Licence number is required" };
    if (!(fee >= 0)) return { success: false, error: "Enter the fee that was paid" };
    if (!paymentMethod) return { success: false, error: "Select how the fee was paid" };
    const now = Date.now();
    if (paymentDate > now + DAY) return { success: false, error: "The payment date cannot be in the future" };

    if (vendor.vendorType === "itinerant" && !app.inspectionDate) {
      return { success: false, error: "Itinerant vendors must be inspected before a licence is issued" };
    }

    const conflict = await licenceNoConflict(ctx, no, vendor._id, appId);
    if (conflict) return { success: false, error: conflict };

    const apps = await ctx.db
      .query("vendorApplications")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendor._id))
      .collect();
    const validity: any = computeValidity(vendor, apps, paymentDate);
    if (validity.error) return { success: false, error: validity.error };

    const patch: any = {
      status: "approved",
      licenceNo: no,
      fee,
      feePaid: true,
      paymentDate,
      paymentMethod,
      receiptNo: receiptNo?.trim() || undefined,
      approvedBy: user._id,
      approvedAt: validity.start, // licence start date
      expiryDate: validity.end,
      notes: notes || app.notes,
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(appId, patch);

    if (validity.end >= now - DAY) await ctx.db.patch(vendor._id, { status: "active", updatedAt: now });
    return { success: true, licenceNo: no, validFrom: validity.start, validTo: validity.end };
  },
});

/** Correct the licence number on a licence that has already been issued. */
export const updateLicenceNumber = mutation({
  args: { token: v.string(), appId: v.id("vendorApplications"), licenceNo: v.string() },
  handler: async (ctx, { token, appId, licenceNo }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const app = await ctx.db.get(appId);
    if (!app || app.status !== "approved") return { success: false, error: "Only an issued licence can be corrected" };
    const no = licenceNo.trim();
    if (!no) return { success: false, error: "Licence number is required" };
    const conflict = await licenceNoConflict(ctx, no, app.vendorId, appId);
    if (conflict) return { success: false, error: conflict };
    await ctx.db.patch(appId, { licenceNo: no });
    return { success: true };
  },
});

export const rejectApplication = mutation({
  args: { token: v.string(), appId: v.id("vendorApplications"), reason: v.string() },
  handler: async (ctx, { token, appId, reason }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const app = await ctx.db.get(appId);
    if (!app) return { success: false, error: "Application not found" };
    if (app.status !== "submitted" && app.status !== "under_review") {
      return { success: false, error: "This application is already closed" };
    }
    if (!reason.trim()) return { success: false, error: "Give a reason for rejecting the application" };
    await ctx.db.patch(appId, { status: "rejected", notes: reason.trim() });
    return { success: true };
  },
});

// ---------- vendor photo ----------

/** Step 1 of an upload: a short-lived URL the browser POSTs the image to. */
export const generatePhotoUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getWriter(ctx, token);
    if (!user) throw new Error("You do not have permission to upload vendor photos");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2: attach the uploaded image to a vendor (replacing and deleting any earlier photo). */
export const setVendorPhoto = mutation({
  args: { token: v.string(), vendorId: v.id("foodVendors"), storageId: v.id("_storage") },
  handler: async (ctx, { token, vendorId, storageId }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to upload vendor photos" };
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };
    const problem = await photoProblem(ctx, storageId);
    if (problem) return { success: false, error: problem };
    if (vendor.photoStorageId && vendor.photoStorageId !== storageId) {
      await ctx.storage.delete(vendor.photoStorageId);
    }
    await ctx.db.patch(vendorId, { photoStorageId: storageId, updatedAt: Date.now() });
    return { success: true };
  },
});

export const removeVendorPhoto = mutation({
  args: { token: v.string(), vendorId: v.id("foodVendors") },
  handler: async (ctx, { token, vendorId }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to remove vendor photos" };
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };
    if (vendor.photoStorageId) await ctx.storage.delete(vendor.photoStorageId);
    await ctx.db.patch(vendorId, { photoStorageId: undefined, updatedAt: Date.now() });
    return { success: true };
  },
});
