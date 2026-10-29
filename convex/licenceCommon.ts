// Rules shared by food vendors and food establishments: sessions, write permission,
// licence state, annual validity, registration numbers. (Contains no Convex functions.)

export const DAY = 86_400_000;
export const RENEWAL_WINDOW_DAYS = 30;

const WRITE_FALLBACK_ROLES = [
  "Medical Officer of Health",
  "Public Health Inspector III",
  "Public Health Inspector II",
  "Sanitation Foreman III",
];

export async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

/** Write access to a food module (role permissions, with a sensible fallback). */
export async function getWriterFor(ctx: any, token: string, module: "foodVendors" | "foodEstablishments") {
  const user = await getSessionUser(ctx, token);
  if (!user) return null;
  const roleDoc = await ctx.db
    .query("roles")
    .withIndex("by_name", (q: any) => q.eq("name", user.role))
    .first();
  const level = roleDoc?.permissions?.[module];
  const allowed = level
    ? level === "write" || level === "admin"
    : WRITE_FALLBACK_ROLES.includes(user.role);
  return allowed ? user : null;
}

export type LicenceState = "none" | "valid" | "expiring" | "expired";

/** Work out the current licence from an application history. */
export function licenceInfo(apps: any[], now: number) {
  const approved = apps
    .filter((a) => a.status === "approved" && a.expiryDate)
    .sort((a, b) => b.expiryDate - a.expiryDate);
  const current = approved[0];
  const open = apps.find((a) => a.status === "submitted" || a.status === "under_review");
  let state: LicenceState = "none";
  let daysLeft: number | undefined;
  if (current) {
    // A licence is valid through the whole of its expiry day.
    daysLeft = Math.floor((current.expiryDate - now) / DAY) + 1;
    state = daysLeft < 0 ? "expired" : daysLeft <= RENEWAL_WINDOW_DAYS ? "expiring" : "valid";
  }
  return { current, open, state, daysLeft };
}

/** The status shown to staff: a holder whose licence has lapsed reads as expired
 *  (suspended and revoked are deliberate decisions and always show as they are). */
export function displayStatus(entity: any, state: LicenceState) {
  const status = entity.status || "pending";
  if ((status === "active" || status === "pending") && state === "expired") return "expired";
  return status;
}

/** Same calendar date one year on, less a day: starting 5 Mar 2026 -> valid to 4 Mar 2027. */
export function oneYearTerm(start: number) {
  const d = new Date(start);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime() - DAY;
}

/**
 * Annual licence period for a payment on `paymentDate`: one year from the payment date, or —
 * when a renewal is paid on or before the old licence's expiry — one year from the day after
 * it, so no paid time is lost. A lapsed licence restarts from the payment date.
 */
export function annualValidity(apps: any[], paymentDate: number) {
  const previous = apps
    .filter((a) => a.status === "approved" && a.expiryDate)
    .sort((a, b) => b.expiryDate - a.expiryDate)[0];
  if (previous && previous.expiryDate >= paymentDate) {
    const start = previous.expiryDate + DAY;
    return { start, end: oneYearTerm(start), basis: "continues_previous", previousExpiry: previous.expiryDate as number };
  }
  return { start: paymentDate, end: oneYearTerm(paymentDate), basis: "payment_date" };
}

/** Next auto-generated registration number, e.g. FV-2026-0007 / FE-2026-0003. */
export async function nextRegistrationNo(ctx: any, table: "foodVendors" | "foodEstablishments", code: "FV" | "FE", year: number) {
  const prefix = `${code}-${year}-`;
  const last = await ctx.db
    .query(table)
    .withIndex("by_reg_no", (q: any) => q.gte("registrationNo", prefix).lt("registrationNo", prefix + "\uffff"))
    .order("desc")
    .first();
  const lastNum = last ? parseInt(String(last.registrationNo).slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
