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

// ── Password Reset Flow ───────────────────────────────────────────────────────

/** Step 1: user submits their email. Always returns success to avoid enumeration. */
export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();

    // Always succeed so we don't reveal whether the email exists
    if (!user || !user.active) return { success: true };

    // Expire any existing reset requests for this email
    const existing = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .collect();
    for (const r of existing) await ctx.db.delete(r._id);

    // 6-digit code + opaque lookup token
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = generateSalt() + generateSalt();
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

    await ctx.db.insert("passwordResets", {
      userId: user._id,
      email: email.toLowerCase(),
      code,
      token,
      expiresAt,
      used: false,
    });

    return { success: true };
  },
});

/** Admin query: list all pending, unexpired, unused reset requests */
export const listPendingResets = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session) return [];
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return [];

    const now = Date.now();
    const resets = await ctx.db.query("passwordResets").collect();
    return resets
      .filter((r) => !r.used && r.expiresAt > now)
      .map((r) => ({
        _id: r._id,
        email: r.email,
        code: r.code,
        expiresAt: r.expiresAt,
        createdAt: r.expiresAt - 2 * 60 * 60 * 1000,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Step 2: validate the reset code without consuming it */
export const validateResetCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const reset = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!reset || reset.used || reset.expiresAt < Date.now() || reset.code !== code) {
      return { valid: false, error: "Invalid or expired code." };
    }
    return { valid: true, token: reset.token };
  },
});

/** Step 3: set new password using the validated token */
export const resetPassword = mutation({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, { token, newPassword }) => {
    const reset = await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!reset || reset.used || reset.expiresAt < Date.now()) {
      return { success: false, error: "Reset link is invalid or has expired." };
    }
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    // Hash new password
    const salt = generateSalt();
    let hash = salt + newPassword;
    let result = 0;
    for (let i = 0; i < 10000; i++) {
      let temp = 0;
      for (let j = 0; j < hash.length; j++) {
        temp = ((temp << 5) - temp + hash.charCodeAt(j)) | 0;
      }
      result = result ^ temp;
      hash = result.toString(36) + salt;
    }
    const passwordHash = Math.abs(result).toString(36) + salt.slice(0, 8);

    await ctx.db.patch(reset.userId, { passwordHash, salt });
    await ctx.db.patch(reset._id, { used: true });

    // Invalidate all sessions for this user
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", reset.userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    return { success: true };
  },
});
