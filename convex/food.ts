import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

// ============ FOOD ESTABLISHMENTS ============
export const listEstablishments = query({
  args: {
    token: v.string(),
    districtId: v.optional(v.id("districts")),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { token, districtId, status, search }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    let estabs = await ctx.db.query("foodEstablishments").order("desc").collect();
    if (districtId) estabs = estabs.filter((e: any) => e.districtId === districtId);
    if (status) estabs = estabs.filter((e: any) => e.status === status);
    if (search) {
      const s = search.toLowerCase();
      estabs = estabs.filter((e: any) =>
        e.establishmentName.toLowerCase().includes(s) ||
        e.ownerName.toLowerCase().includes(s) ||
        e.registrationNo.toLowerCase().includes(s)
      );
    }
    // Attach latest licence info + linked vendor count
    const enriched = await Promise.all(estabs.map(async (estab: any) => {
      const apps = await ctx.db.query("establishmentApplications")
        .withIndex("by_establishment", q => q.eq("establishmentId", estab._id))
        .collect();
      const latest = apps
        .filter((a: any) => a.status === "approved")
        .sort((a: any, b: any) => (b.expiryDate || 0) - (a.expiryDate || 0))[0];
      // Count linked vendors
      const linkedVendors = await ctx.db.query("foodVendors")
        .withIndex("by_establishment", q => q.eq("linkedEstablishmentId", estab._id))
        .collect();
      return {
        ...estab,
        currentLicenceNo: latest?.licenceNo,
        licenceExpiry: latest?.expiryDate,
        licenceFeePaid: latest?.feePaid,
        linkedVendorCount: linkedVendors.length,
      };
    }));
    return enriched;
  },
});

export const getEstablishment = query({
  args: { token: v.string(), estabId: v.id("foodEstablishments") },
  handler: async (ctx, { token, estabId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    const estab = await ctx.db.get(estabId);
    if (!estab) return null;
    const apps = await ctx.db.query("establishmentApplications").withIndex("by_establishment", q => q.eq("establishmentId", estabId)).collect();
    apps.sort((a: any, b: any) => b.year - a.year);
    return { establishment: estab, applications: apps };
  },
});

export const createEstablishment = mutation({
  args: {
    token: v.string(),
    establishmentName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    registrationNo: v.string(),
    establishmentType: v.string(),
    seatingCapacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...data }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer" || user.role === "Litter Warden") return { success: false, error: "Unauthorized" };
    const now = Date.now();
    const id = await ctx.db.insert("foodEstablishments", {
      ...data,
      registrationDate: now,
      status: "pending",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create first application for current year
    await ctx.db.insert("establishmentApplications", {
      establishmentId: id,
      year: new Date().getFullYear(),
      applicationDate: now,
      status: "submitted",
      feePaid: false,
      createdBy: user._id,
      createdAt: now,
    });

    return { success: true, id };
  },
});

export const updateEstablishment = mutation({
  args: {
    token: v.string(),
    estabId: v.id("foodEstablishments"),
    establishmentName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    status: v.optional(v.string()),
    establishmentType: v.optional(v.string()),
    seatingCapacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, estabId, ...updates }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };
    const patch: any = { ...updates, updatedAt: Date.now() };
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(estabId, patch);
    return { success: true };
  },
});

export const createEstablishmentApplication = mutation({
  args: {
    token: v.string(),
    establishmentId: v.id("foodEstablishments"),
    year: v.number(),
    fee: v.optional(v.number()),
    inspectionDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, establishmentId, year, fee, inspectionDate, notes }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };
    const id = await ctx.db.insert("establishmentApplications", {
      establishmentId,
      year,
      applicationDate: Date.now(),
      status: "submitted",
      fee,
      feePaid: false,
      inspectionDate,
      notes,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

export const updateEstablishmentApplication = mutation({
  args: {
    token: v.string(),
    appId: v.id("establishmentApplications"),
    status: v.optional(v.string()),
    feePaid: v.optional(v.boolean()),
    expiryDate: v.optional(v.number()),
    inspectionDate: v.optional(v.number()),
    inspectionNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, appId, ...updates }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };
    const patch: any = { ...updates };
    if (updates.status === "approved") {
      patch.approvedBy = user._id;
      patch.approvedAt = Date.now();
    }
    if (updates.status === "under_review") {
      patch.inspectedBy = user._id;
    }
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(appId, patch);
    return { success: true };
  },
});

// Dedicated approve mutation with licence + payment tracking
export const approveEstablishmentApplication = mutation({
  args: {
    token: v.string(),
    appId: v.id("establishmentApplications"),
    licenceNo: v.string(),
    fee: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    receiptNo: v.optional(v.string()),
    expiryDate: v.number(),
    inspectionDate: v.optional(v.number()),
    inspectionNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, appId, licenceNo, fee, paymentMethod, receiptNo, expiryDate, inspectionDate, inspectionNotes, notes }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };

    // Check licence number uniqueness across establishment applications
    const existingEstab = await ctx.db.query("establishmentApplications")
      .filter((q: any) => q.eq(q.field("licenceNo"), licenceNo))
      .first();
    if (existingEstab && existingEstab._id !== appId) {
      return { success: false, error: `Licence number "${licenceNo}" is already in use` };
    }
    // Also check vendor applications
    const existingVendor = await ctx.db.query("vendorApplications")
      .filter((q: any) => q.eq(q.field("licenceNo"), licenceNo))
      .first();
    if (existingVendor) {
      return { success: false, error: `Licence number "${licenceNo}" is already in use by a vendor` };
    }

    const now = Date.now();
    await ctx.db.patch(appId, {
      status: "approved",
      licenceNo,
      fee,
      feePaid: true,
      paymentDate: now,
      paymentMethod,
      receiptNo,
      expiryDate,
      approvedBy: user._id,
      approvedAt: now,
      inspectionDate,
      inspectedBy: inspectionDate ? user._id : undefined,
      inspectionNotes,
      notes,
    });

    // Update parent establishment status to active
    const app = await ctx.db.get(appId);
    if (app) {
      await ctx.db.patch(app.establishmentId, { status: "active", updatedAt: now });
    }

    return { success: true };
  },
});

// ============ CROSS-ENTITY QUERIES ============

// List all vendors linked to a specific establishment
export const getVendorsByEstablishment = query({
  args: { token: v.string(), establishmentId: v.id("foodEstablishments") },
  handler: async (ctx, { token, establishmentId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    const vendors = await ctx.db.query("foodVendors")
      .withIndex("by_establishment", q => q.eq("linkedEstablishmentId", establishmentId))
      .collect();
    // Attach latest licence for each
    return Promise.all(vendors.map(async (vendor: any) => {
      const apps = await ctx.db.query("vendorApplications")
        .withIndex("by_vendor", q => q.eq("vendorId", vendor._id))
        .collect();
      const latest = apps
        .filter((a: any) => a.status === "approved")
        .sort((a: any, b: any) => (b.expiryDate || 0) - (a.expiryDate || 0))[0];
      return {
        ...vendor,
        currentLicenceNo: latest?.licenceNo,
        licenceExpiry: latest?.expiryDate,
      };
    }));
  },
});

// Get vendors/establishments with licences expiring within 30 days
export const getExpiringLicences = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { vendors: [], establishments: [] };

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const threshold = now + thirtyDaysMs;

    // Get all approved vendor applications expiring within 30 days
    const vendorApps = await ctx.db.query("vendorApplications").collect();
    const expiringVendorApps = vendorApps.filter((a: any) =>
      a.status === "approved" && a.expiryDate && a.expiryDate <= threshold && a.expiryDate >= now
    );
    const vendors = await Promise.all(expiringVendorApps.map(async (app: any) => {
      const vendor = await ctx.db.get(app.vendorId);
      return vendor ? { ...vendor, licenceNo: app.licenceNo, licenceExpiry: app.expiryDate, daysRemaining: Math.ceil((app.expiryDate - now) / (24 * 60 * 60 * 1000)) } : null;
    }));

    // Get all approved establishment applications expiring within 30 days
    const estabApps = await ctx.db.query("establishmentApplications").collect();
    const expiringEstabApps = estabApps.filter((a: any) =>
      a.status === "approved" && a.expiryDate && a.expiryDate <= threshold && a.expiryDate >= now
    );
    const establishments = await Promise.all(expiringEstabApps.map(async (app: any) => {
      const estab = await ctx.db.get(app.establishmentId);
      return estab ? { ...estab, licenceNo: app.licenceNo, licenceExpiry: app.expiryDate, daysRemaining: Math.ceil((app.expiryDate - now) / (24 * 60 * 60 * 1000)) } : null;
    }));

    return {
      vendors: vendors.filter(Boolean),
      establishments: establishments.filter(Boolean),
    };
  },
});

// List all active establishments (for vendor registration dropdown)
export const listActiveEstablishments = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    const estabs = await ctx.db.query("foodEstablishments").collect();
    return estabs
      .filter((e: any) => e.status === "active" || e.status === "pending")
      .map((e: any) => ({ _id: e._id, establishmentName: e.establishmentName, registrationNo: e.registrationNo, address: e.address }));
  },
});
