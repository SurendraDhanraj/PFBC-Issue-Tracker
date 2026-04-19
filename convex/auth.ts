import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple hash using Web Crypto (browser-compatible)
function generateSalt(): string {
  const array = new Uint8Array(16);
  // Use Math.random for server-side salt generation
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hashPassword(password: string, salt: string): string {
  // Simple but deterministic hash - PBKDF-like using repeated XOR
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

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }
    if (!user.active) {
      return { success: false, error: "Account is inactive. Contact your administrator." };
    }

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return { success: false, error: "Invalid email or password" };
    }

    // Create session token
    const token = generateSalt() + generateSalt() + Date.now().toString(36);
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

    // Invalidate old sessions
    const old = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const s of old) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.insert("sessions", { userId: user._id, token, expiresAt });

    // Look up role permissions
    const roleDoc = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", user.role))
      .first();

    return {
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedDistricts: user.assignedDistricts,
        initials: user.initials,
        permissions: roleDoc?.permissions ?? null,
      },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { success: true };
  },
});

export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    const user = await ctx.db.get(session.userId);
    if (!user || !user.active) return null;
    // Join with roles table for permissions
    const roleDoc = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", user.role))
      .first();
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedDistricts: user.assignedDistricts,
      initials: user.initials,
      phone: user.phone,
      permissions: roleDoc?.permissions ?? null,
    };
  },
});

export const createInitialAdmin = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { name, email, password }) => {
    // Only allow if no admin exists
    const existing = await ctx.db.query("users").first();
    if (existing) {
      return { success: false, error: "Users already exist" };
    }
    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    await ctx.db.insert("users", {
      name,
      email: email.toLowerCase(),
      passwordHash,
      salt,
      role: "Medical Officer of Health",
      assignedDistricts: ["ALL"],
      active: true,
      initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      createdAt: Date.now(),
    });
    return { success: true };
  },
});
