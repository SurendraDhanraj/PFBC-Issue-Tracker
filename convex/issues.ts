import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SUPERVISOR_ROLES = [
  "Medical Officer of Health",
  "Public Health Inspector III",
];

const MANAGER_ROLES = ["Medical Officer of Health"];

async function getSessionUser(ctx: any, token: string) {
  const session = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

export const listIssues = query({
  args: {
    token: v.string(),
    districtId: v.optional(v.id("districts")),
    status: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, { token, districtId, status, categoryId, assignedTo }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return [];
    const user = await ctx.db.get(session.userId);
    if (!user) return [];

    let issues = await ctx.db.query("issues").order("desc").collect();

    // Filter by assigned districts (unless ALL)
    if (!user.assignedDistricts.includes("ALL")) {
      const userDistricts = await ctx.db.query("districts").collect();
      const allowedIds = userDistricts
        .filter((d: any) => user.assignedDistricts.includes(d.code) || user.assignedDistricts.includes(d._id))
        .map((d: any) => d._id);
      issues = issues.filter((i: any) => allowedIds.includes(i.districtId));
    }

    if (districtId) issues = issues.filter((i: any) => i.districtId === districtId);
    if (status) issues = issues.filter((i: any) => i.status === status);
    if (categoryId) issues = issues.filter((i: any) => i.categoryId === categoryId);
    if (assignedTo) issues = issues.filter((i: any) => i.assignedTo === assignedTo);

    return issues;
  },
});

export const getIssue = query({
  args: { token: v.string(), issueId: v.id("issues") },
  handler: async (ctx, { token, issueId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    return await ctx.db.get(issueId);
  },
});

export const createIssue = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    priority: v.string(),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    address: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getSessionUser(ctx, args.token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (user.role === "Viewer") return { success: false, error: "Viewers cannot create issues" };

    const now = Date.now();
    const id = await ctx.db.insert("issues", {
      title: args.title,
      description: args.description,
      categoryId: args.categoryId,
      status: "created",
      priority: args.priority as any,
      districtId: args.districtId,
      streetId: args.streetId,
      address: args.address,
      assignedTo: args.assignedTo,
      reportedBy: user._id,
      notes: [],
      subtasks: [],
      lat: args.lat,
      lng: args.lng,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const updateIssue = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    categoryId: v.optional(v.id("categories")),
    districtId: v.optional(v.id("districts")),
    streetId: v.optional(v.id("streets")),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, { token, issueId, ...updates }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Issue not found" };

    // Closing requires Supervisor+
    if (updates.status === "closed" && !SUPERVISOR_ROLES.includes(user.role)) {
      return { success: false, error: "Only Supervisors can close issues" };
    }

    const patch: any = { ...updates, updatedAt: Date.now() };
    if (updates.status === "closed") patch.closedAt = Date.now();
    // Remove undefined values
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    await ctx.db.patch(issueId, patch);
    return { success: true };
  },
});

export const addNote = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    text: v.string(),
    storageId: v.optional(v.id("_storage")),
    mediaType: v.optional(v.string()),
    mediaName: v.optional(v.string()),
  },
  handler: async (ctx, { token, issueId, text, storageId, mediaType, mediaName }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (user.role === "Viewer") return { success: false, error: "Viewers cannot add notes" };

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Not found" };

    const note: any = {
      text,
      authorId: user._id,
      authorName: user.name,
      authorRole: user.role,
      timestamp: Date.now(),
    };
    if (storageId) note.storageId = storageId;
    if (mediaType) note.mediaType = mediaType;
    if (mediaName) note.mediaName = mediaName;

    const patch: any = {
      notes: [...issue.notes, note],
      updatedAt: Date.now(),
    };
    // Auto-advance: created → in_progress on first activity
    if (issue.status === "created") {
      patch.status = "in_progress";
    }

    await ctx.db.patch(issueId, patch);
    return { success: true };
  },
});

export const addSubtask = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    title: v.string(),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, { token, issueId, title, assignedTo }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (!SUPERVISOR_ROLES.includes(user.role)) {
      return { success: false, error: "Only Supervisors+ can manage subtasks" };
    }

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Not found" };

    let assignedName;
    if (assignedTo) {
      const assignee = await ctx.db.get(assignedTo);
      assignedName = assignee?.name;
    }

    const subtask: any = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title,
      completed: false,
      createdAt: Date.now(),
    };
    if (assignedTo) subtask.assignedTo = assignedTo;
    if (assignedName) subtask.assignedName = assignedName;

    await ctx.db.patch(issueId, {
      subtasks: [...issue.subtasks, subtask],
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const toggleSubtask = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    subtaskId: v.string(),
  },
  handler: async (ctx, { token, issueId, subtaskId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Not found" };

    const subtasks = issue.subtasks.map((s: any) => {
      if (s.id === subtaskId) {
        return {
          ...s,
          completed: !s.completed,
          completedAt: !s.completed ? Date.now() : undefined,
        };
      }
      return s;
    });

    await ctx.db.patch(issueId, { subtasks, updatedAt: Date.now() });
    return { success: true };
  },
});

export const updateSubtask = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    subtaskId: v.string(),
    title: v.string(),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, { token, issueId, subtaskId, title, assignedTo }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (!SUPERVISOR_ROLES.includes(user.role)) {
      return { success: false, error: "Only Supervisors+ can manage subtasks" };
    }

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Not found" };

    let assignedName: string | undefined;
    if (assignedTo) {
      const assignee = await ctx.db.get(assignedTo);
      assignedName = assignee?.name;
    }

    const subtasks = issue.subtasks.map((s: any) => {
      if (s.id !== subtaskId) return s;
      const updated: any = { ...s, title };
      if (assignedTo) {
        updated.assignedTo = assignedTo;
        updated.assignedName = assignedName;
      } else {
        delete updated.assignedTo;
        delete updated.assignedName;
      }
      return updated;
    });

    await ctx.db.patch(issueId, { subtasks, updatedAt: Date.now() });
    return { success: true };
  },
});

export const deleteSubtask = mutation({
  args: {
    token: v.string(),
    issueId: v.id("issues"),
    subtaskId: v.string(),
  },
  handler: async (ctx, { token, issueId, subtaskId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (!SUPERVISOR_ROLES.includes(user.role)) {
      return { success: false, error: "Only Supervisors+ can manage subtasks" };
    }

    const issue = await ctx.db.get(issueId);
    if (!issue) return { success: false, error: "Not found" };

    const subtasks = issue.subtasks.filter((s: any) => s.id !== subtaskId);
    await ctx.db.patch(issueId, { subtasks, updatedAt: Date.now() });
    return { success: true };
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const deleteIssue = mutation({
  args: { token: v.string(), issueId: v.id("issues") },
  handler: async (ctx, { token, issueId }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (user.role !== "Medical Officer of Health")
      return { success: false, error: "Only the Medical Officer of Health can delete issues" };
    await ctx.db.delete(issueId);
    return { success: true };
  },
});

export const deleteAllIssues = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) return { success: false, error: "Unauthorized" };
    if (user.role !== "Medical Officer of Health")
      return { success: false, error: "Only the Medical Officer of Health can delete all issues" };
    const issues = await ctx.db.query("issues").collect();
    for (const issue of issues) await ctx.db.delete(issue._id);
    return { success: true, count: issues.length };
  },
});


export const getDashboardStats = query({
  args: { token: v.string(), districtId: v.optional(v.id("districts")) },
  handler: async (ctx, { token, districtId }) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", q => q.eq("token", token)).first();
    if (!session) return null;
    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    let issues = await ctx.db.query("issues").collect();

    if (!user.assignedDistricts.includes("ALL")) {
      const allDistricts = await ctx.db.query("districts").collect();
      const allowedIds = allDistricts
        .filter((d: any) => user.assignedDistricts.includes(d.code))
        .map((d: any) => d._id);
      issues = issues.filter((i: any) => allowedIds.includes(i.districtId));
    }
    if (districtId) issues = issues.filter((i: any) => i.districtId === districtId);

    // Status counts
    const created    = issues.filter((i: any) => i.status === "created" || i.status === "open").length;
    const inProgress = issues.filter((i: any) => i.status === "in_progress").length;
    const closed     = issues.filter((i: any) => i.status === "closed" || i.status === "resolved").length;

    // Priority counts
    const urgent = issues.filter((i: any) => i.priority === "urgent").length;
    const high   = issues.filter((i: any) => i.priority === "high").length;
    const medium = issues.filter((i: any) => i.priority === "medium").length;
    const low    = issues.filter((i: any) => i.priority === "low").length;

    // Monthly new issues — past 12 calendar months
    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const count = issues.filter((iss: any) => {
        const cd = new Date(iss.createdAt);
        return cd.getFullYear() === yr && cd.getMonth() === mo;
      }).length;
      return {
        label: d.toLocaleString("en-TT", { month: "short" }),
        year: yr,
        month: mo,
        count,
      };
    });

    const recent = issues
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 8);

    return { created, inProgress, closed, total: issues.length, urgent, high, medium, low, monthly, recent };
  },
});
