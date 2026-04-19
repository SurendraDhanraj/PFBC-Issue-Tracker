import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Auth
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
    role: v.string(), // dynamic — managed via roles table
    assignedDistricts: v.array(v.string()), // district codes or "ALL"
    active: v.boolean(),
    phone: v.optional(v.string()),
    initials: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  roles: defineTable({
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    active: v.boolean(),
    sortOrder: v.number(),
    permissions: v.optional(v.object({
      dashboard: v.optional(v.string()),
      issues: v.optional(v.string()),
      foodVendors: v.optional(v.string()),
      foodEstablishments: v.optional(v.string()),
      staffManagement: v.optional(v.string()),
      leaveTracker: v.optional(v.string()),
      adminPanel: v.optional(v.string()),
    })),
  })
    .index("by_sort", ["sortOrder"])
    .index("by_name", ["name"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Geography
  districts: defineTable({
    name: v.string(),
    code: v.string(),
    pollingDivision: v.optional(v.string()),
    corporation: v.optional(v.string()),
  }).index("by_code", ["code"]),

  streets: defineTable({
    name: v.string(),
    districtId: v.id("districts"),
  }).index("by_district", ["districtId"]),

  // Issues
  issues: defineTable({
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("pending"),
      v.literal("resolved"),
      v.literal("closed"),
      v.literal("critical")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    address: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    reportedBy: v.id("users"),
    notes: v.array(
      v.object({
        text: v.string(),
        authorId: v.string(),
        authorName: v.string(),
        timestamp: v.number(),
        storageId: v.optional(v.id("_storage")),
        mediaType: v.optional(v.string()),
        mediaName: v.optional(v.string()),
        mediaUrl: v.optional(v.string()),
      })
    ),
    subtasks: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        completed: v.boolean(),
        assignedTo: v.optional(v.string()),
        assignedName: v.optional(v.string()),
        createdAt: v.number(),
        completedAt: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_category", ["categoryId"])
    .index("by_district", ["districtId"])
    .index("by_assigned", ["assignedTo"])
    .index("by_reported", ["reportedBy"])
    .index("by_created", ["createdAt"]),

  categories: defineTable({
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    description: v.string(),
    active: v.boolean(),
    sortOrder: v.number(),
  }),

  // Food Vendors (mobile/street)
  foodVendors: defineTable({
    vendorName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    registrationNo: v.string(),
    registrationDate: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("suspended"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    vendorType: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_district", ["districtId"])
    .index("by_status", ["status"])
    .index("by_reg_no", ["registrationNo"]),

  vendorApplications: defineTable({
    vendorId: v.id("foodVendors"),
    year: v.number(),
    applicationDate: v.number(),
    status: v.union(
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    expiryDate: v.optional(v.number()),
    fee: v.optional(v.number()),
    feePaid: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_vendor", ["vendorId"])
    .index("by_year", ["year"]),

  // Food Establishments (fixed premises)
  foodEstablishments: defineTable({
    establishmentName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.string(),
    districtId: v.id("districts"),
    streetId: v.optional(v.id("streets")),
    registrationNo: v.string(),
    registrationDate: v.number(),
    establishmentType: v.string(), // Restaurant, Bakery, Shop, etc.
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("suspended"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    seatingCapacity: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_district", ["districtId"])
    .index("by_status", ["status"])
    .index("by_reg_no", ["registrationNo"]),

  establishmentApplications: defineTable({
    establishmentId: v.id("foodEstablishments"),
    year: v.number(),
    applicationDate: v.number(),
    status: v.union(
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    expiryDate: v.optional(v.number()),
    fee: v.optional(v.number()),
    feePaid: v.optional(v.boolean()),
    inspectionDate: v.optional(v.number()),
    inspectedBy: v.optional(v.id("users")),
    inspectionNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_establishment", ["establishmentId"])
    .index("by_year", ["year"]),

  // Leave
  leaveTypes: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    maxDaysPerYear: v.optional(v.number()),
    active: v.boolean(),
    sortOrder: v.number(),
  }),

  leaveRequests: defineTable({
    userId: v.id("users"),
    leaveTypeId: v.id("leaveTypes"),
    startDate: v.string(), // ISO date string YYYY-MM-DD
    endDate: v.string(),
    days: v.number(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_start", ["startDate"]),
});
