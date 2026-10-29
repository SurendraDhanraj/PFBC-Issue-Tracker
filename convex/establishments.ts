import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  DAY, RENEWAL_WINDOW_DAYS, getSessionUser, getWriterFor, licenceInfo, displayStatus,
  annualValidity, nextRegistrationNo,
} from "./licenceCommon";

// ============================================================
// Food establishments — registration, annual licence, renewals,
// and the vendors who work in each establishment.
//
//  - Registration numbers are auto-generated: FE-YYYY-NNNN
//  - Licence numbers are entered manually and are unique across
//    vendors AND establishments
//  - Payment is recorded manually; the validity period is set
//    automatically from the payment (one year)
//  - An inspection is required before a licence is issued
//  - Renewals open 30 days before expiry; every licence and renewal
//    is kept as history
//  - A registered vendor can be assigned to one establishment at a
//    time; assignments are kept as history
// ============================================================

const STATUSES = ["active", "pending", "suspended", "expired", "revoked"];

const getWriter = (ctx: any, token: string) => getWriterFor(ctx, token, "foodEstablishments");

/** Assigning changes both an establishment's staff list and a vendor record, so both permissions are needed. */
async function getAssigner(ctx: any, token: string) {
  const estabWriter = await getWriter(ctx, token);
  if (!estabWriter) return null;
  return await getWriterFor(ctx, token, "foodVendors");
}

/** Licence numbers are unique per holder: an establishment may keep its own number across renewals,
 *  but no vendor or other establishment may use it. */
async function licenceNoConflict(ctx: any, no: string, establishmentId: any, exceptAppId?: any): Promise<string | null> {
  const estabUses = await ctx.db
    .query("establishmentApplications")
    .withIndex("by_licence", (q: any) => q.eq("licenceNo", no))
    .collect();
  if (estabUses.some((a: any) => a._id !== exceptAppId && a.establishmentId !== establishmentId)) {
    return `Licence number "${no}" is already in use`;
  }
  const vendorUse = await ctx.db
    .query("vendorApplications")
    .withIndex("by_licence", (q: any) => q.eq("licenceNo", no))
    .first();
  if (vendorUse) return `Licence number "${no}" is already in use by a vendor`;
  return null;
}

async function vendorsOf(ctx: any, establishmentId: any) {
  return await ctx.db
    .query("foodVendors")
    .withIndex("by_establishment", (q: any) => q.eq("linkedEstablishmentId", establishmentId))
    .collect();
}

// ---------- queries ----------

export const listEstablishments = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return [];
    const now = Date.now();
    const estabs = await ctx.db.query("foodEstablishments").order("desc").collect();
    return await Promise.all(
      estabs.map(async (e: any) => {
        const apps = await ctx.db
          .query("establishmentApplications")
          .withIndex("by_establishment", (q: any) => q.eq("establishmentId", e._id))
          .collect();
        const info = licenceInfo(apps, now);
        const vendors = await vendorsOf(ctx, e._id);
        return {
          ...e,
          displayStatus: displayStatus(e, info.state),
          licenceState: info.state,
          daysLeft: info.daysLeft,
          currentLicenceNo: info.current?.licenceNo,
          licenceExpiry: info.current?.expiryDate,
          hasOpenApplication: !!info.open,
          vendorCount: vendors.length,
        };
      })
    );
  },
});

/** Establishments a vendor can be linked to (used by the vendor registration form). */
export const listActive = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return [];
    const estabs = await ctx.db.query("foodEstablishments").collect();
    return estabs
      .filter((e: any) => e.status === "active" || e.status === "pending")
      .map((e: any) => ({
        _id: e._id,
        establishmentName: e.establishmentName,
        registrationNo: e.registrationNo,
        address: e.address,
      }));
  },
});

export const getEstablishment = query({
  args: { token: v.string(), establishmentId: v.id("foodEstablishments") },
  handler: async (ctx, { token, establishmentId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return null;
    const estab = await ctx.db.get(establishmentId);
    if (!estab) return null;
    const now = Date.now();

    const apps = await ctx.db
      .query("establishmentApplications")
      .withIndex("by_establishment", (q: any) => q.eq("establishmentId", establishmentId))
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
    const canApply = !info.open && (info.state === "none" || info.state === "expiring" || info.state === "expired");

    // Vendors working here now, plus the full assignment history
    const assignmentRows = await ctx.db
      .query("vendorAssignments")
      .withIndex("by_establishment", (q: any) => q.eq("establishmentId", establishmentId))
      .collect();
    assignmentRows.sort((a: any, b: any) => b.startDate - a.startDate);
    const startOf: Record<string, number> = {};
    assignmentRows.forEach((a: any) => { if (!a.endDate) startOf[a.vendorId] = a.startDate; });

    const current = await vendorsOf(ctx, establishmentId);
    const vendors = await Promise.all(
      current.map(async (vendor: any) => {
        const vApps = await ctx.db
          .query("vendorApplications")
          .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendor._id))
          .collect();
        const vInfo = licenceInfo(vApps, now);
        return {
          ...vendor,
          displayStatus: displayStatus(vendor, vInfo.state),
          licenceState: vInfo.state,
          daysLeft: vInfo.daysLeft,
          currentLicenceNo: vInfo.current?.licenceNo,
          licenceExpiry: vInfo.current?.expiryDate,
          assignedSince: startOf[vendor._id],
          photoUrl: vendor.photoStorageId ? await ctx.storage.getUrl(vendor.photoStorageId) : null,
        };
      })
    );
    const assignments = await Promise.all(
      assignmentRows.map(async (a: any) => {
        const vendor = await ctx.db.get(a.vendorId);
        return {
          ...a,
          vendorName: vendor ? [vendor.vendorName, vendor.vendorSurname || vendor.ownerName].filter(Boolean).join(" ") : "(removed)",
          vendorRegNo: vendor?.registrationNo,
        };
      })
    );

    return {
      establishment: { ...estab, displayStatus: displayStatus(estab, info.state) },
      applications: history,
      currentLicence: (info.current && history.find((h: any) => h._id === info.current._id)) || null,
      licenceState: info.state,
      daysLeft: info.daysLeft,
      openApplication: info.open || null,
      renewalOpensAt,
      canApply,
      vendors,
      assignments,
    };
  },
});

/** Registered vendors who are not working in any establishment (candidates for assignment). */
export const listUnassignedVendors = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return [];
    const vendors = await ctx.db.query("foodVendors").order("desc").collect();
    return await Promise.all(
      vendors
        .filter((x: any) => !x.linkedEstablishmentId)
        .map(async (x: any) => ({
          _id: x._id,
          vendorName: x.vendorName,
          vendorSurname: x.vendorSurname || x.ownerName,
          registrationNo: x.registrationNo,
          vendorType: x.vendorType,
          status: x.status,
          photoUrl: x.photoStorageId ? await ctx.storage.getUrl(x.photoStorageId) : null,
        }))
    );
  },
});

// ---------- registration ----------

export const createEstablishment = mutation({
  args: {
    token: v.string(),
    establishmentName: v.string(),
    ownerName: v.string(),
    establishmentType: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    seatingCapacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...data }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to register establishments" };
    if (!data.establishmentName.trim() || !data.ownerName.trim() || !data.address.trim()) {
      return { success: false, error: "Establishment name, owner and address are required" };
    }
    if (!data.establishmentType.trim()) return { success: false, error: "Choose the type of establishment" };
    if (data.seatingCapacity !== undefined && !(data.seatingCapacity >= 0)) {
      return { success: false, error: "Seating capacity must be zero or more" };
    }

    const now = Date.now();
    const year = new Date(now).getFullYear();
    const registrationNo = await nextRegistrationNo(ctx, "foodEstablishments", "FE", year);

    const doc: any = {
      ...data,
      establishmentName: data.establishmentName.trim(),
      ownerName: data.ownerName.trim(),
      address: data.address.trim(),
      registrationNo,
      registrationDate: now,
      status: "pending",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    };
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);
    const id = await ctx.db.insert("foodEstablishments", doc);

    // First licence application is opened with the registration.
    await ctx.db.insert("establishmentApplications", {
      establishmentId: id,
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

export const updateEstablishment = mutation({
  args: {
    token: v.string(),
    establishmentId: v.id("foodEstablishments"),
    establishmentName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    establishmentType: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    seatingCapacity: v.optional(v.number()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, establishmentId, ...updates }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to edit establishments" };
    const estab = await ctx.db.get(establishmentId);
    if (!estab) return { success: false, error: "Establishment not found" };

    if (updates.status !== undefined) {
      if (!STATUSES.includes(updates.status)) return { success: false, error: "Invalid status" };
      if (updates.status === "active") {
        const apps = await ctx.db
          .query("establishmentApplications")
          .withIndex("by_establishment", (q: any) => q.eq("establishmentId", establishmentId))
          .collect();
        const info = licenceInfo(apps, Date.now());
        if (info.state === "none" || info.state === "expired") {
          return { success: false, error: "An establishment can only be active while it holds a valid licence" };
        }
      }
    }

    const patch: any = { ...updates, updatedAt: Date.now() };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(establishmentId, patch);
    return { success: true };
  },
});

// ---------- licence workflow ----------

/** Open a new application — the first licence, or a renewal inside the 30-day window. */
export const startApplication = mutation({
  args: {
    token: v.string(),
    establishmentId: v.id("foodEstablishments"),
    fee: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, establishmentId, fee, notes }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const estab = await ctx.db.get(establishmentId);
    if (!estab) return { success: false, error: "Establishment not found" };

    const now = Date.now();
    const apps = await ctx.db
      .query("establishmentApplications")
      .withIndex("by_establishment", (q: any) => q.eq("establishmentId", establishmentId))
      .collect();
    const info = licenceInfo(apps, now);

    if (info.open) return { success: false, error: "There is already an open application for this establishment" };
    if (info.state === "valid" && info.current) {
      const opens = new Date(info.current.expiryDate - RENEWAL_WINDOW_DAYS * DAY).toLocaleDateString("en-GB");
      return { success: false, error: `Renewal opens ${RENEWAL_WINDOW_DAYS} days before expiry, on ${opens}` };
    }

    const id = await ctx.db.insert("establishmentApplications", {
      establishmentId,
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

export const recordInspection = mutation({
  args: {
    token: v.string(),
    appId: v.id("establishmentApplications"),
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

/** What validity period would a payment on this date give? (Shown before the payment is saved.) */
export const previewValidity = query({
  args: { token: v.string(), establishmentId: v.id("foodEstablishments"), paymentDate: v.number() },
  handler: async (ctx, { token, establishmentId, paymentDate }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return null;
    const estab = await ctx.db.get(establishmentId);
    if (!estab) return null;
    const apps = await ctx.db
      .query("establishmentApplications")
      .withIndex("by_establishment", (q: any) => q.eq("establishmentId", establishmentId))
      .collect();
    return annualValidity(apps, paymentDate);
  },
});

/**
 * Record the payment and update the licence: the licence number is entered manually and the
 * validity period is set automatically from the payment (one year, see annualValidity).
 */
export const issueLicence = mutation({
  args: {
    token: v.string(),
    appId: v.id("establishmentApplications"),
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
    const estab = await ctx.db.get(app.establishmentId as any);
    if (!estab) return { success: false, error: "Establishment not found" };

    const no = licenceNo.trim();
    if (!no) return { success: false, error: "Licence number is required" };
    if (!(fee >= 0)) return { success: false, error: "Enter the fee that was paid" };
    if (!paymentMethod) return { success: false, error: "Select how the fee was paid" };
    const now = Date.now();
    if (paymentDate > now + DAY) return { success: false, error: "The payment date cannot be in the future" };

    if (!app.inspectionDate) {
      return { success: false, error: "The establishment must be inspected before a licence is issued" };
    }

    const conflict = await licenceNoConflict(ctx, no, estab._id, appId);
    if (conflict) return { success: false, error: conflict };

    const apps = await ctx.db
      .query("establishmentApplications")
      .withIndex("by_establishment", (q: any) => q.eq("establishmentId", estab._id))
      .collect();
    const validity = annualValidity(apps, paymentDate);

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

    if (validity.end >= now - DAY) await ctx.db.patch(estab._id, { status: "active", updatedAt: now });
    return { success: true, licenceNo: no, validFrom: validity.start, validTo: validity.end };
  },
});

/** Correct the licence number on a licence that has already been issued. */
export const updateLicenceNumber = mutation({
  args: { token: v.string(), appId: v.id("establishmentApplications"), licenceNo: v.string() },
  handler: async (ctx, { token, appId, licenceNo }) => {
    const user = await getWriter(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to manage licences" };
    const app = await ctx.db.get(appId);
    if (!app || app.status !== "approved") return { success: false, error: "Only an issued licence can be corrected" };
    const no = licenceNo.trim();
    if (!no) return { success: false, error: "Licence number is required" };
    const conflict = await licenceNoConflict(ctx, no, app.establishmentId, appId);
    if (conflict) return { success: false, error: conflict };
    await ctx.db.patch(appId, { licenceNo: no });
    return { success: true };
  },
});

export const rejectApplication = mutation({
  args: { token: v.string(), appId: v.id("establishmentApplications"), reason: v.string() },
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

// ---------- vendor assignment ----------

/**
 * Assign a registered vendor to work in an establishment. The vendor becomes a "within
 * establishment" vendor. A vendor works at one establishment at a time, so assigning a vendor
 * who already works elsewhere transfers them (the old assignment is closed).
 */
export const assignVendor = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    establishmentId: v.id("foodEstablishments"),
    startDate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, establishmentId, startDate, note }) => {
    const user = await getAssigner(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to assign vendors" };

    const estab = await ctx.db.get(establishmentId);
    if (!estab) return { success: false, error: "Establishment not found" };
    if (estab.status === "suspended" || estab.status === "revoked") {
      return { success: false, error: `Vendors cannot be assigned to a ${estab.status} establishment` };
    }
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };
    if (vendor.linkedEstablishmentId === establishmentId) {
      return { success: false, error: "This vendor already works at this establishment" };
    }

    const now = Date.now();
    const start = startDate ?? now;
    if (start > now + DAY) return { success: false, error: "The start date cannot be in the future" };

    // Close the current assignment if the vendor is being transferred
    let transferred = false;
    if (vendor.linkedEstablishmentId) {
      const open = await ctx.db
        .query("vendorAssignments")
        .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
        .collect();
      for (const row of open.filter((r: any) => !r.endDate)) {
        await ctx.db.patch(row._id, { endDate: Math.max(start, row.startDate), endedBy: user._id });
      }
      transferred = true;
    }

    await ctx.db.insert("vendorAssignments", {
      vendorId,
      establishmentId,
      startDate: start,
      previousType: vendor.vendorType,
      note: note?.trim() || undefined,
      assignedBy: user._id,
      createdAt: now,
    });

    // Working in an establishment replaces the itinerant route / event details
    await ctx.db.patch(vendorId, {
      vendorType: "establishment",
      linkedEstablishmentId: establishmentId,
      operatingArea: undefined,
      eventName: undefined,
      eventStartDate: undefined,
      eventEndDate: undefined,
      updatedAt: now,
    });
    return { success: true, transferred };
  },
});

/** The vendor stops working at their establishment (the assignment is kept as history). */
export const unassignVendor = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    endDate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, endDate, note }) => {
    const user = await getAssigner(ctx, token);
    if (!user) return { success: false, error: "You do not have permission to assign vendors" };
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return { success: false, error: "Vendor not found" };
    if (!vendor.linkedEstablishmentId) return { success: false, error: "This vendor is not assigned to an establishment" };

    const now = Date.now();
    const end = endDate ?? now;
    if (end > now + DAY) return { success: false, error: "The end date cannot be in the future" };

    const rows = await ctx.db
      .query("vendorAssignments")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", vendorId))
      .collect();
    const open = rows.filter((r: any) => !r.endDate);
    if (open.some((r: any) => end < r.startDate)) {
      return { success: false, error: "The end date cannot be before the start date" };
    }
    for (const row of open) {
      await ctx.db.patch(row._id, {
        endDate: end,
        endedBy: user._id,
        note: note?.trim() ? (row.note ? `${row.note} — ${note.trim()}` : note.trim()) : row.note,
      });
    }
    await ctx.db.patch(vendorId, { linkedEstablishmentId: undefined, updatedAt: now });
    return { success: true };
  },
});
