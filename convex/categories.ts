import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").order("asc").collect();
  },
});

export const createCategory = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { token, name, color, icon, description }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };
    const count = (await ctx.db.query("categories").collect()).length;
    const id = await ctx.db.insert("categories", { name, color, icon, description, active: true, sortOrder: count });
    return { success: true, id };
  },
});

export const updateCategory = mutation({
  args: {
    token: v.string(),
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, categoryId, ...updates }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };
    const patch: any = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.color !== undefined) patch.color = updates.color;
    if (updates.icon !== undefined) patch.icon = updates.icon;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.active !== undefined) patch.active = updates.active;
    await ctx.db.patch(categoryId, patch);
    return { success: true };
  },
});
