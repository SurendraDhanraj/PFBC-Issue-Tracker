import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAdminUser(ctx: any, token: string) {
  const session = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!session) return null;
  return await ctx.db.get(session.userId);
}

/** Public — no auth required (needed to show splash before login) */
export const getAppSettings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "main")).first();
  },
});

/** Resolve storage IDs to URLs */
export const getSettingsFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

/** Admin-only: update branding fields */
export const updateAppSettings = mutation({
  args: {
    token: v.string(),
    appName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    faviconStorageId: v.optional(v.id("_storage")),
    splashStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { token, ...fields }) => {
    const user = await getAdminUser(ctx, token);
    if (!user || user.role !== "Medical Officer of Health") {
      return { success: false, error: "Unauthorized" };
    }
    const existing = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "main")).first();
    const patch: any = {};
    if (fields.appName !== undefined) patch.appName = fields.appName;
    if (fields.tagline !== undefined) patch.tagline = fields.tagline;
    if (fields.faviconStorageId !== undefined) patch.faviconStorageId = fields.faviconStorageId;
    if (fields.splashStorageId !== undefined) patch.splashStorageId = fields.splashStorageId;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("appSettings", { key: "main", ...patch });
    }
    return { success: true };
  },
});

/** Admin-only: get a one-time upload URL for branding assets */
export const generateBrandingUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getAdminUser(ctx, token);
    if (!user || user.role !== "Medical Officer of Health") throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});
