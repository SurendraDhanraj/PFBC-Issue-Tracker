import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getSessionUser } from "./licenceCommon";

// ============================================================
// Staff signatures and badge signatories
//
//  - Each staff member can have a signature image (a transparent PNG)
//  - The food vendor badge is signed by two people: the Medical Officer
//    of Health and a Public Health Inspector
//  - Who signs is set in the Admin Panel. When it isn't set, the system
//    follows current staffing:
//       MOH -> the active Medical Officer of Health
//       PHI -> the inspector who issued the licence (if still active)
// ============================================================

const MOH_ROLE = "Medical Officer of Health";
const PHI_ROLE_PREFIX = "Public Health Inspector";
const MAX_SIGNATURE_BYTES = 1.5 * 1024 * 1024;

const isAdmin = (user: any) => user?.role === MOH_ROLE;

/** Check an uploaded file really is a reasonably sized PNG. Returns an error message, or null if fine. */
async function signatureProblem(ctx: any, storageId: any): Promise<string | null> {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) return "The uploaded signature could not be found";
  if (meta.contentType !== "image/png") return "The signature must be a PNG image";
  if (meta.size > MAX_SIGNATURE_BYTES) return "The signature image is too large (maximum 1.5 MB)";
  return null;
}

async function slot(ctx: any, user: any) {
  if (!user) return null;
  return {
    userId: user._id,
    name: user.name,
    role: user.role,
    signatureUrl: user.signatureStorageId ? await ctx.storage.getUrl(user.signatureStorageId) : null,
  };
}

async function getSettings(ctx: any) {
  return await ctx.db.query("appSettings").withIndex("by_key", (q: any) => q.eq("key", "main")).first();
}

// ---------- who signs a badge ----------

/** The two people who sign a badge right now, with their signature images (any signed-in user). */
export const getBadgeSignatories = query({
  args: { token: v.string(), issuedBy: v.optional(v.id("users")) },
  handler: async (ctx, { token, issuedBy }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return null;
    const settings = await getSettings(ctx);
    const users = await ctx.db.query("users").collect();
    const active = users.filter((u: any) => u.active);

    // Medical Officer of Health
    let moh: any = settings?.badgeMohUserId ? await ctx.db.get(settings.badgeMohUserId) : null;
    let mohConfigured = !!(moh && moh.active);
    if (!mohConfigured) {
      const candidates = active.filter((u: any) => u.role === MOH_ROLE);
      moh = candidates.find((u: any) => u.signatureStorageId) || candidates[0] || null;
    }

    // Public Health Inspector
    let phi: any = settings?.badgePhiUserId ? await ctx.db.get(settings.badgePhiUserId) : null;
    let phiConfigured = !!(phi && phi.active);
    if (!phiConfigured) {
      phi = null;
      if (issuedBy) {
        const issuer = await ctx.db.get(issuedBy);
        if (issuer && issuer.active && String(issuer.role).startsWith(PHI_ROLE_PREFIX)) phi = issuer;
      }
    }

    return {
      moh: await slot(ctx, moh),
      mohConfigured,
      phi: await slot(ctx, phi),
      phiConfigured,
    };
  },
});

/** Admin Panel: the current choices and the staff who can be chosen. */
export const getSignatorySettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!isAdmin(user)) return null;
    const settings = await getSettings(ctx);
    const users = await ctx.db.query("users").collect();
    const keep = new Set([settings?.badgeMohUserId, settings?.badgePhiUserId].filter(Boolean));
    const staff = await Promise.all(
      users
        .filter((u: any) => u.active || keep.has(u._id))
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
        .map(async (u: any) => ({
          _id: u._id,
          name: u.name,
          role: u.role,
          active: u.active,
          signatureUrl: u.signatureStorageId ? await ctx.storage.getUrl(u.signatureStorageId) : null,
        }))
    );
    return {
      mohUserId: settings?.badgeMohUserId ?? null,
      phiUserId: settings?.badgePhiUserId ?? null,
      staff,
    };
  },
});

/** Set (or clear, with null) who signs the badge. Only the Medical Officer of Health can change this. */
export const setBadgeSignatories = mutation({
  args: {
    token: v.string(),
    mohUserId: v.optional(v.union(v.id("users"), v.null())),
    phiUserId: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, { token, mohUserId, phiUserId }) => {
    const user = await getSessionUser(ctx, token);
    if (!isAdmin(user)) return { success: false, error: "Only the Medical Officer of Health can choose the badge signatories" };

    const patch: any = {};
    for (const [field, value] of [["badgeMohUserId", mohUserId], ["badgePhiUserId", phiUserId]] as const) {
      if (value === undefined) continue;
      if (value === null) { patch[field] = undefined; continue; }
      const chosen = await ctx.db.get(value);
      if (!chosen || !chosen.active) return { success: false, error: "Choose an active staff member" };
      patch[field] = value;
    }

    const existing = await getSettings(ctx);
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("appSettings", { key: "main", ...patch });
    return { success: true };
  },
});

// ---------- a staff member's signature image ----------

/** Admin or the staff member themself may see the stored signature. */
export const getUserSignature = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || (!isAdmin(user) && user._id !== userId)) return null;
    const target = await ctx.db.get(userId);
    if (!target?.signatureStorageId) return null;
    return await ctx.storage.getUrl(target.signatureStorageId);
  },
});

/** Step 1 of an upload: a short-lived URL the browser POSTs the PNG to. */
export const generateSignatureUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) throw new Error("Please sign in again");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2: attach the uploaded PNG to a staff member (replacing and deleting any earlier one). */
export const setSignature = mutation({
  args: { token: v.string(), userId: v.id("users"), storageId: v.id("_storage") },
  handler: async (ctx, { token, userId, storageId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || (!isAdmin(user) && user._id !== userId)) {
      return { success: false, error: "You can only change your own signature" };
    }
    const target = await ctx.db.get(userId);
    if (!target) return { success: false, error: "Staff member not found" };
    const problem = await signatureProblem(ctx, storageId);
    if (problem) return { success: false, error: problem };
    if (target.signatureStorageId && target.signatureStorageId !== storageId) {
      await ctx.storage.delete(target.signatureStorageId);
    }
    await ctx.db.patch(userId, { signatureStorageId: storageId });
    return { success: true };
  },
});

export const removeSignature = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user || (!isAdmin(user) && user._id !== userId)) {
      return { success: false, error: "You can only change your own signature" };
    }
    const target = await ctx.db.get(userId);
    if (!target) return { success: false, error: "Staff member not found" };
    if (target.signatureStorageId) await ctx.storage.delete(target.signatureStorageId);
    await ctx.db.patch(userId, { signatureStorageId: undefined });
    return { success: true };
  },
});
