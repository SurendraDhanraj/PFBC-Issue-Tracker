import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateSalt(): string {
  let salt = "";
  for (let i = 0; i < 32; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

function hashPassword(password: string, salt: string): string {
  let hash = salt + password;
  let result = 0;
  for (let i = 0; i < 10000; i++) {
    let temp = 0;
    for (let j = 0; j < hash.length; j++) {
      temp = ((temp << 5) - temp + hash.charCodeAt(j)) | 0;
    }
    result = result ^ temp;
    hash = result.toString(36) + salt;
  }
  return Math.abs(result).toString(36) + salt.slice(0, 8);
}


export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    return await ctx.db.query("users").collect();
  },
});

export const getUser = query({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    return await ctx.db.get(userId);
  },
});

export const createUser = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.string(),
    assignedDistricts: v.array(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { token, name, email, password, role, assignedDistricts, phone }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") {
      return { success: false, error: "Only the Medical Officer of Health can manage users" };
    }
    const existing = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", email.toLowerCase())).first();
    if (existing) return { success: false, error: "Email already in use" };

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    const userId = await ctx.db.insert("users", {
      name,
      email: email.toLowerCase(),
      passwordHash,
      salt,
      role,
      assignedDistricts,
      active: true,
      phone,
      initials,
      createdAt: Date.now(),
    });
    return { success: true, userId };
  },
});

export const updateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    assignedDistricts: v.optional(v.array(v.string())),
    phone: v.optional(v.string()),
    active: v.optional(v.boolean()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { token, userId, name, email, role, assignedDistricts, phone, active, password }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") {
      return { success: false, error: "Unauthorized" };
    }
    const updates: any = {};
    if (name !== undefined) {
      updates.name = name;
      updates.initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email !== undefined) {
      const existing = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", email.toLowerCase())).first();
      if (existing && existing._id !== userId) return { success: false, error: "Email already in use" };
      updates.email = email.toLowerCase();
    }
    if (role !== undefined) updates.role = role;
    if (assignedDistricts !== undefined) updates.assignedDistricts = assignedDistricts;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = active;
    if (password) {
      const salt = generateSalt();
      updates.salt = salt;
      updates.passwordHash = hashPassword(password, salt);
    }
    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

export const deleteUser = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };
    if (session.userId === userId) return { success: false, error: "Cannot delete yourself" };
    await ctx.db.patch(userId, { active: false });
    return { success: true };
  },
});
