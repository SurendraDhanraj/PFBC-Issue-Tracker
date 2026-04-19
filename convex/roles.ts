import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export type PermissionLevel = "none" | "view" | "write" | "admin";
export interface RolePermissions {
  dashboard?: string;
  issues?: string;
  foodVendors?: string;
  foodEstablishments?: string;
  staffManagement?: string;
  leaveTracker?: string;
  adminPanel?: string;
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  "Medical Officer of Health": {
    dashboard: "admin", issues: "admin", foodVendors: "admin",
    foodEstablishments: "admin", staffManagement: "admin", leaveTracker: "admin", adminPanel: "admin",
  },
  "Public Health Inspector III": {
    dashboard: "view", issues: "admin", foodVendors: "write",
    foodEstablishments: "write", staffManagement: "view", leaveTracker: "write", adminPanel: "none",
  },
  "Public Health Inspector II": {
    dashboard: "view", issues: "write", foodVendors: "write",
    foodEstablishments: "write", staffManagement: "none", leaveTracker: "write", adminPanel: "none",
  },
  "Public Health Inspector I": {
    dashboard: "view", issues: "write", foodVendors: "view",
    foodEstablishments: "view", staffManagement: "none", leaveTracker: "write", adminPanel: "none",
  },
  "Sanitation Foreman III": {
    dashboard: "view", issues: "write", foodVendors: "write",
    foodEstablishments: "write", staffManagement: "none", leaveTracker: "write", adminPanel: "none",
  },
  "Sanitation Foreman II": {
    dashboard: "view", issues: "write", foodVendors: "view",
    foodEstablishments: "view", staffManagement: "none", leaveTracker: "write", adminPanel: "none",
  },
  "Sanitation Foreman I": {
    dashboard: "view", issues: "write", foodVendors: "none",
    foodEstablishments: "none", staffManagement: "none", leaveTracker: "write", adminPanel: "none",
  },
  "Litter Warden": {
    dashboard: "view", issues: "write", foodVendors: "none",
    foodEstablishments: "none", staffManagement: "none", leaveTracker: "view", adminPanel: "none",
  },
  "Clerical": {
    dashboard: "view", issues: "view", foodVendors: "view",
    foodEstablishments: "view", staffManagement: "none", leaveTracker: "view", adminPanel: "none",
  },
  "Viewer": {
    dashboard: "view", issues: "view", foodVendors: "none",
    foodEstablishments: "none", staffManagement: "none", leaveTracker: "view", adminPanel: "none",
  },
};

const DEFAULT_ROLES = [
  { name: "Medical Officer of Health", color: "#ef4444", description: "Chief medical administrator", sortOrder: 1 },
  { name: "Public Health Inspector III", color: "#f59e0b", description: "Senior public health inspector", sortOrder: 2 },
  { name: "Public Health Inspector II", color: "#3b82f6", description: "Intermediate public health inspector", sortOrder: 3 },
  { name: "Public Health Inspector I", color: "#06b6d4", description: "Junior public health inspector", sortOrder: 4 },
  { name: "Sanitation Foreman III", color: "#8b5cf6", description: "Senior sanitation supervisor", sortOrder: 5 },
  { name: "Sanitation Foreman II", color: "#6366f1", description: "Intermediate sanitation supervisor", sortOrder: 6 },
  { name: "Sanitation Foreman I", color: "#64748b", description: "Junior sanitation supervisor", sortOrder: 7 },
  { name: "Litter Warden", color: "#10b981", description: "Litter enforcement officer", sortOrder: 8 },
  { name: "Clerical", color: "#94a3b8", description: "Administrative and clerical support", sortOrder: 9 },
  { name: "Viewer", color: "#475569", description: "Read-only access", sortOrder: 10 },
];

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").withIndex("by_sort").collect();
  },
});

export const getRoleByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db.query("roles").withIndex("by_name", q => q.eq("name", name)).first();
  },
});

export const createRole = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, color, description }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };

    const existing = await ctx.db.query("roles").collect();
    const dupe = existing.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (dupe) return { success: false, error: "A role with that name already exists" };

    const sortOrder = existing.length > 0 ? Math.max(...existing.map(r => r.sortOrder)) + 1 : 1;
    const permissions = DEFAULT_ROLE_PERMISSIONS[name] || {
      dashboard: "view", issues: "view", foodVendors: "none",
      foodEstablishments: "none", staffManagement: "none", leaveTracker: "view", adminPanel: "none",
    };
    const id = await ctx.db.insert("roles", { name, color, description, active: true, sortOrder, permissions });
    return { success: true, id };
  },
});

export const updateRole = mutation({
  args: {
    token: v.string(),
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    permissions: v.optional(v.object({
      dashboard: v.optional(v.string()),
      issues: v.optional(v.string()),
      foodVendors: v.optional(v.string()),
      foodEstablishments: v.optional(v.string()),
      staffManagement: v.optional(v.string()),
      leaveTracker: v.optional(v.string()),
      adminPanel: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { token, roleId, name, color, description, active, sortOrder, permissions }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };

    const updates: any = {};
    if (name !== undefined) {
      const role = await ctx.db.get(roleId);
      if (role && role.name !== name) {
        const usersWithOldRole = await ctx.db.query("users").withIndex("by_role", q => q.eq("role", role.name)).collect();
        for (const u of usersWithOldRole) {
          await ctx.db.patch(u._id, { role: name });
        }
      }
      updates.name = name;
    }
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (active !== undefined) updates.active = active;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (permissions !== undefined) updates.permissions = permissions;

    await ctx.db.patch(roleId, updates);
    return { success: true };
  },
});

export const seedDefaultRoles = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };

    const existing = await ctx.db.query("roles").collect();
    if (existing.length > 0) return { success: false, error: "Roles already seeded" };

    for (const role of DEFAULT_ROLES) {
      const permissions = DEFAULT_ROLE_PERMISSIONS[role.name] || { dashboard: "view" };
      await ctx.db.insert("roles", { ...role, active: true, permissions });
    }
    return { success: true, count: DEFAULT_ROLES.length };
  },
});
