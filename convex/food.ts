import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

// ============ FOOD VENDORS ============
export const listVendors = query({
  args: { token: v.string(), districtId: v.optional(v.id("districts")), status: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, { token, districtId, status, search }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    let vendors = await ctx.db.query("foodVendors").order("desc").collect();
    if (districtId) vendors = vendors.filter((v: any) => v.districtId === districtId);
    if (status) vendors = vendors.filter((v: any) => v.status === status);
    if (search) {
      const s = search.toLowerCase();
      vendors = vendors.filter((v: any) =>
        v.vendorName.toLowerCase().includes(s) ||
        v.ownerName.toLowerCase().includes(s) ||
        v.registrationNo.toLowerCase().includes(s)
      );
    }
    return vendors;
  },
});

export const getVendor = query({
  args: { token: v.string(), vendorId: v.id("foodVendors") },
  handler: async (ctx, { token, vendorId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    const vendor = await ctx.db.get(vendorId);
    const apps = await ctx.db.query("vendorApplications").withIndex("by_vendor", q => q.eq("vendorId", vendorId)).collect();
    return { vendor, applications: apps };
  },
});

export const createVendor = mutation({
  args: {
    token: v.string(),
    vendorName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    registrationNo: v.string(),
    vendorType: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...data }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer" || user.role === "Litter Warden") return { success: false, error: "Unauthorized" };
    const now = Date.now();
    const id = await ctx.db.insert("foodVendors", {
      ...data,
      registrationDate: now,
      status: "pending",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const updateVendor = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    vendorName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, ...updates }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };
    const patch: any = { ...updates, updatedAt: Date.now() };
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(vendorId, patch);
    return { success: true };
  },
});

export const createVendorApplication = mutation({
  args: {
    token: v.string(),
    vendorId: v.id("foodVendors"),
    year: v.number(),
    fee: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, vendorId, year, fee, notes }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || user.role === "Viewer") return { success: false, error: "Unauthorized" };
    const id = await ctx.db.insert("vendorApplications", {
      vendorId,
      year,
      applicationDate: Date.now(),
      status: "submitted",
      fee,
      feePaid: false,
      notes,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

export const updateVendorApplication = mutation({
  args: {
    token: v.string(),
    appId: v.id("vendorApplications"),
    status: v.optional(v.string()),
    feePaid: v.optional(v.boolean()),
    expiryDate: v.optional(v.number()),
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
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(appId, patch);
    return { success: true };
  },
});

// ============ FOOD ESTABLISHMENTS ============
export const listEstablishments = query({
  args: { token: v.string(), districtId: v.optional(v.id("districts")), status: v.optional(v.string()), search: v.optional(v.string()) },
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
    return estabs;
  },
});

export const getEstablishment = query({
  args: { token: v.string(), estabId: v.id("foodEstablishments") },
  handler: async (ctx, { token, estabId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    const estab = await ctx.db.get(estabId);
    const apps = await ctx.db.query("establishmentApplications").withIndex("by_establishment", q => q.eq("establishmentId", estabId)).collect();
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
      patch.inspectedBy = user._id;
    }
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(appId, patch);
    return { success: true };
  },
});
