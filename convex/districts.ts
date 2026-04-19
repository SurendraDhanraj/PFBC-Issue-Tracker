import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listDistricts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("districts").order("asc").collect();
  },
});

export const listStreets = query({
  args: { districtId: v.optional(v.id("districts")) },
  handler: async (ctx, { districtId }) => {
    if (districtId) {
      return await ctx.db.query("streets").withIndex("by_district", q => q.eq("districtId", districtId)).collect();
    }
    return await ctx.db.query("streets").collect();
  },
});

export const uploadDistrictsFromCSV = mutation({
  args: {
    token: v.string(),
    // Array of {districtName, pollingDivision, streets, corporation}
    data: v.array(v.object({
      districtName: v.string(),
      pollingDivision: v.string(),
      corporation: v.string(),
      streets: v.array(v.string()),
    })),
  },
  handler: async (ctx, { token, data }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") {
      return { success: false, error: "Only MOH can upload district data" };
    }

    let districtCount = 0;
    let streetCount = 0;

    for (const row of data) {
      // Check if district exists
      const existing = await ctx.db.query("districts")
        .withIndex("by_code", q => q.eq("code", row.pollingDivision))
        .first();

      let districtId;
      if (!existing) {
        districtId = await ctx.db.insert("districts", {
          name: row.districtName,
          code: row.pollingDivision,
          pollingDivision: row.pollingDivision,
          corporation: row.corporation,
        });
        districtCount++;
      } else {
        districtId = existing._id;
      }

      // Add streets
      const existingStreets = await ctx.db.query("streets")
        .withIndex("by_district", q => q.eq("districtId", districtId))
        .collect();
      const existingStreetNames = new Set(existingStreets.map((s: any) => s.name.toLowerCase()));

      for (const streetName of row.streets) {
        if (streetName && !existingStreetNames.has(streetName.toLowerCase())) {
          await ctx.db.insert("streets", { name: streetName, districtId });
          existingStreetNames.add(streetName.toLowerCase());
          streetCount++;
        }
      }
    }

    return { success: true, districtCount, streetCount };
  },
});

export const addDistrict = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    code: v.string(),
    corporation: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, code, corporation }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };

    const existing = await ctx.db.query("districts").withIndex("by_code", q => q.eq("code", code)).first();
    if (existing) return { success: false, error: "District code already exists" };

    const id = await ctx.db.insert("districts", { name, code, corporation });
    return { success: true, id };
  },
});

export const addStreet = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    districtId: v.id("districts"),
  },
  handler: async (ctx, { token, name, districtId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };

    const id = await ctx.db.insert("streets", { name, districtId });
    return { success: true, id };
  },
});
