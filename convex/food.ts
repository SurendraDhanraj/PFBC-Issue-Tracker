import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

// Establishment and vendor registration now live in establishments.ts and vendors.ts.

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

