import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listLeaveTypes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("leaveTypes").order("asc").collect();
  },
});

export const createLeaveType = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    maxDaysPerYear: v.optional(v.number()),
  },
  handler: async (ctx, { token, name, description, maxDaysPerYear }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };
    const count = (await ctx.db.query("leaveTypes").collect()).length;
    const id = await ctx.db.insert("leaveTypes", {
      name, description, maxDaysPerYear, active: true, sortOrder: count,
    });
    return { success: true, id };
  },
});

export const updateLeaveType = mutation({
  args: {
    token: v.string(),
    leaveTypeId: v.id("leaveTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    maxDaysPerYear: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, leaveTypeId, ...updates }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "Medical Officer of Health") return { success: false, error: "Unauthorized" };
    const patch: any = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.maxDaysPerYear !== undefined) patch.maxDaysPerYear = updates.maxDaysPerYear;
    if (updates.active !== undefined) patch.active = updates.active;
    await ctx.db.patch(leaveTypeId, patch);
    return { success: true };
  },
});

// Leave Requests
export const listLeaveRequests = query({
  args: {
    token: v.string(),
    userId: v.optional(v.id("users")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, userId, status }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    const me = await ctx.db.get(session.userId);
    if (!me) return [];

    let requests = await ctx.db.query("leaveRequests").order("desc").collect();

    // Regular staff can only see their own
    const supervisorRoles = ["Medical Officer of Health", "Public Health Inspector III", "Public Health Inspector II"];
    if (!supervisorRoles.includes(me.role)) {
      requests = requests.filter((r: any) => r.userId === session.userId);
    }

    if (userId) requests = requests.filter((r: any) => r.userId === userId);
    if (status) requests = requests.filter((r: any) => r.status === status);

    return requests;
  },
});

export const createLeaveRequest = mutation({
  args: {
    token: v.string(),
    leaveTypeId: v.id("leaveTypes"),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, leaveTypeId, startDate, endDate, days, reason }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const user = await ctx.db.get(session.userId);
    if (!user || user.role === "Viewer") return { success: false, error: "Cannot submit leave request" };

    const now = Date.now();
    const id = await ctx.db.insert("leaveRequests", {
      userId: session.userId,
      leaveTypeId,
      startDate,
      endDate,
      days,
      reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const approveLeave = mutation({
  args: {
    token: v.string(),
    requestId: v.id("leaveRequests"),
    action: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { token, requestId, action, rejectionReason }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const user = await ctx.db.get(session.userId);
    const supervisorRoles = ["Medical Officer of Health", "Public Health Inspector III", "Public Health Inspector II"];
    if (!user || !supervisorRoles.includes(user.role)) {
      return { success: false, error: "Only supervisors can approve/reject leave" };
    }

    const patch: any = {
      status: action,
      approvedBy: session.userId,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (rejectionReason) patch.rejectionReason = rejectionReason;

    await ctx.db.patch(requestId, patch);
    return { success: true };
  },
});

export const cancelLeave = mutation({
  args: { token: v.string(), requestId: v.id("leaveRequests") },
  handler: async (ctx, { token, requestId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return { success: false, error: "Unauthorized" };
    const req = await ctx.db.get(requestId);
    if (!req) return { success: false, error: "Not found" };
    if (req.userId !== session.userId) return { success: false, error: "Can only cancel your own requests" };
    if (req.status !== "pending") return { success: false, error: "Can only cancel pending requests" };
    await ctx.db.patch(requestId, { status: "cancelled", updatedAt: Date.now() });
    return { success: true };
  },
});
