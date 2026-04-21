import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Static seed data (no hardcoded IDs — fetched live) ───────────────────────

const STATUSES = ["open", "in_progress", "in_progress", "closed", "resolved"] as const;
const PRIORITIES = ["urgent", "urgent", "high", "high", "medium", "medium", "low"] as const;

const TITLES = [
  "Blocked drain causing flooding on Main Road",
  "Illegal dumping of waste near residential area",
  "Mosquito breeding in stagnant water pool",
  "Suspected food poisoning at roadside vendor",
  "Low water pressure affecting community",
  "Stray dogs causing nuisance in neighbourhood",
  "Burning of garbage in open lot",
  "Dead animal on public road causing odour",
  "Overflowing skip and refuse bin on High Street",
  "Contaminated water supply complaints",
  "Rat infestation at Johnson Street",
  "Unauthorized food vendor operating without permit",
  "Industrial effluent discharge into river",
  "Noisy bar operating past permitted hours",
  "Sewage overflow on Church Street",
  "Abandoned vehicle attracting vermin",
  "Overgrown bush blocking drainage canal",
  "Open defecation near children's playground",
  "Chemical smell from nearby factory",
  "Collapsed culvert causing road flooding",
  "Pigpen too close to residential homes",
  "Market area flooding every night",
  "Dust nuisance from quarry operations",
  "Cockroach infestation at school canteen",
  "Expired food items sold at grocery",
  "Children playing in sewage water",
  "Illegal construction blocking drain",
  "Smoke from charcoal kiln affecting residents",
  "Standing water breeding mosquitoes near school",
  "Waste oil dumped in mangrove area",
  "Pet dogs not vaccinated causing bite incidents",
  "Overhead powerline leaking near water pond",
  "Unhygienic conditions at fish market",
  "Blocked culvert causing backyard flooding",
  "Unlicensed slaughterhouse in residential area",
  "Odour from derelict pond affecting homes",
  "Leptospirosis risk after flood event",
  "Noise from commercial generator operating 24/7",
  "Livestock running loose on public road",
  "Disused tyres harbouring mosquitoes beside school",
];

const DESCRIPTIONS = [
  "Residents have been complaining for several weeks. Site inspection reveals serious health risk.",
  "Multiple households affected. Immediate intervention recommended.",
  "Breeding site confirmed during preliminary inspection. Larviciding required.",
  "Several persons reported illness following consumption. Samples collected.",
  "WASA notified. Residents relying on water trucks. Situation critical.",
  "Dogs congregating in numbers. Biting incidents reported by two families.",
  "Burning occurring nightly. Smoke affecting respiratory health of elderly neighbours.",
  "Carcass observed in advanced decomposition. Road safety and health risk.",
  "Bins not emptied for two weeks. Overflow attracting rodents and insects.",
  "Cloudy water with unusual odour. Possible pipeline contamination upstream.",
];

const NOTE_TEXTS = [
  "Inspected site — issue confirmed. Photographs taken and report filed.",
  "Contacted property owner. Compliance deadline set for next week.",
  "Samples sent to lab for analysis. Awaiting results.",
  "Vector control team dispatched. Larviciding completed in the area.",
  "Issued verbal warning. Follow-up inspection scheduled.",
  "Coordinated with WASA regarding water supply complaint.",
  "Served abatement notice to responsible party.",
  "Community members interviewed. Root cause identified as blocked main drain.",
  "Enforcement action initiated. Magistrate proceedings pending.",
  "Area cleared and sanitised by sanitation crew.",
  "Follow-up visit completed. Significant improvement observed.",
  "Owner submitted compliance plan. Under review.",
  "Escalated to senior inspector for review.",
  "Pest control treatment applied. Monitoring continues.",
  "Complaint referred to Environment Management Authority.",
];

const ADDRESSES = [
  "12 Cipero Street, San Fernando",
  "45 High Street, Point Fortin",
  "Lot 6, Mahaica Village",
  "Corner Church & Coffee Street, Erin",
  "88 Erin Road, Guapo",
  "New Village Community Centre",
  "Hollywood Recreation Ground",
  "Cedros Main Road opposite Health Centre",
  "Techier Trace, Guapo Bay",
  "Egypt Village Junction",
  "Fanny Village, Cap-de-Ville",
  "Newlands Estate, Mahaica",
  "ERIN Community Centre Grounds",
  "Bamboo Village, Cedros",
  "Cap-de-Ville Health Post",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  return Date.now() - n * 86_400_000;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
export const _verifyToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    return !!session;
  },
});

/** Fetch all category IDs from the live DB */
export const _fetchCategories = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    return cats.map((c) => c._id);
  },
});

/** Fetch all district IDs from the live DB */
export const _fetchDistricts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const dists = await ctx.db.query("districts").collect();
    return dists.map((d) => d._id);
  },
});

/** Fetch all user IDs + names from the live DB */
export const _fetchUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ id: u._id, name: u.name ?? "Inspector" }));
  },
});

export const _deleteAllIssues = internalMutation({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("issues").collect();
    for (const issue of issues) await ctx.db.delete(issue._id);
    return issues.length;
  },
});

export const _createIssue = internalMutation({
  args: {
    title:        v.string(),
    description:  v.string(),
    categoryId:   v.id("categories"),
    districtId:   v.id("districts"),
    priority:     v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    status:       v.union(
      v.literal("open"), v.literal("in_progress"), v.literal("pending"),
      v.literal("resolved"), v.literal("closed"), v.literal("critical")
    ),
    address:      v.string(),
    reportedBy:   v.id("users"),
    reporterName: v.optional(v.string()),
    createdAt:    v.number(),
    storageId:    v.optional(v.id("_storage")),
    mediaName:    v.optional(v.string()),
    docStorageId: v.optional(v.id("_storage")),
    docName:      v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const note: any = {
      text:       "Issue logged via field inspection.",
      authorId:   args.reportedBy,
      authorName: args.reporterName ?? "Inspector",
      timestamp:  args.createdAt,
    };
    if (args.storageId) {
      note.storageId = args.storageId;
      note.mediaType = "image/jpeg";
      note.mediaName = args.mediaName ?? "photo.jpg";
    }

    const docNote: any | null = args.docStorageId
      ? {
          text:      "Inspection report attached.",
          authorId:  args.reportedBy,
          authorName: args.reporterName ?? "Inspector",
          timestamp: args.createdAt + 60_000,
          storageId: args.docStorageId,
          mediaType: "document",
          mediaName: args.docName ?? "report.pdf",
        }
      : null;

    const notes = docNote ? [note, docNote] : [note];

    return await ctx.db.insert("issues", {
      title:       args.title,
      description: args.description,
      categoryId:  args.categoryId,
      districtId:  args.districtId,
      priority:    args.priority,
      status:      args.status,
      address:     args.address,
      reportedBy:  args.reportedBy,
      createdAt:   args.createdAt,
      updatedAt:   args.createdAt,
      notes,
      subtasks:    [],
    });
  },
});

export const _addNote = internalMutation({
  args: {
    issueId:    v.id("issues"),
    text:       v.string(),
    authorId:   v.id("users"),
    authorName: v.string(),
    timestamp:  v.number(),
    storageId:  v.optional(v.id("_storage")),
    mediaName:  v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return;
    const note: any = {
      text:      args.text,
      authorId:  args.authorId,
      authorName:args.authorName,
      timestamp: args.timestamp,
    };
    if (args.storageId) {
      note.storageId = args.storageId;
      note.mediaType = "image/jpeg";
      note.mediaName = args.mediaName ?? "note_photo.jpg";
    }
    const notes = [...(issue.notes ?? []), note];
    await ctx.db.patch(args.issueId, { notes, updatedAt: args.timestamp });
  },
});

// ─── Storage upload helpers (run inside action) ───────────────────────────────
async function uploadImage(ctx: any, i: number): Promise<string | null> {
  try {
    const id  = ((i * 7 + 3) % 85) + 10; // picsum ids 10-94
    const url = `https://picsum.photos/id/${id}/600/400`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const uploadUrl: string = await ctx.storage.generateUploadUrl();
    const up = await fetch(uploadUrl, {
      method:  "POST",
      headers: { "Content-Type": "image/jpeg" },
      body:    blob,
    });
    if (!up.ok) return null;
    const { storageId } = await up.json();
    return storageId;
  } catch {
    return null;
  }
}

async function uploadPdf(ctx: any, index: number): Promise<string | null> {
  try {
    const title = TITLES[index % TITLES.length];
    const pdfBytes = buildMinimalPdf(`Public Health Inspection Report #${index + 1}`, title);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const uploadUrl: string = await ctx.storage.generateUploadUrl();
    const up = await fetch(uploadUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/pdf" },
      body:    blob,
    });
    if (!up.ok) return null;
    const { storageId } = await up.json();
    return storageId;
  } catch {
    return null;
  }
}

function buildMinimalPdf(heading: string, body: string): string {
  const safe = (s: string) => s.replace(/[()\\]/g, " ").slice(0, 60);
  return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 180>>stream
BT /F1 14 Tf 72 720 Td (${safe(heading)}) Tj
0 -24 Td /F1 11 Tf (${safe(body)}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref 0
%%EOF`;
}

// ─── Main action ──────────────────────────────────────────────────────────────
export const seedTestIssues = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const ok: boolean = await ctx.runQuery(internal.seedIssues._verifyToken, { token });
    if (!ok) throw new Error("Unauthorized");

    // 0. Fetch live IDs from this deployment's DB
    const CATEGORIES: any[] = await ctx.runQuery(internal.seedIssues._fetchCategories, {});
    const DISTRICTS:  any[] = await ctx.runQuery(internal.seedIssues._fetchDistricts,  {});
    const USERS: Array<{ id: any; name: string }> =
      await ctx.runQuery(internal.seedIssues._fetchUsers, {});

    if (!CATEGORIES.length) throw new Error("No categories found — run seedAll first");
    if (!DISTRICTS.length)  throw new Error("No districts found — run seedDistricts first");
    if (!USERS.length)      throw new Error("No users found — run seedAll first");

    // 1. Wipe existing issues
    const deleted: number = await ctx.runMutation(internal.seedIssues._deleteAllIssues, {});

    const log: string[] = [
      `🗑️  Deleted ${deleted} existing issues`,
      `📋 Found ${CATEGORIES.length} categories, ${DISTRICTS.length} districts, ${USERS.length} users`,
    ];

    // 2. Create 40 issues spread over the past year
    for (let i = 0; i < 40; i++) {
      const user      = pick(USERS);
      const createdAt = daysAgo(randInt(0, 365));
      const status    = pick(STATUSES);
      const priority  = pick(PRIORITIES);

      // Upload image (all issues get one)
      const storageId = await uploadImage(ctx, i);

      // 50 % chance of a PDF report
      const docStorageId = Math.random() > 0.5 ? await uploadPdf(ctx, i) : null;

      const issueId: any = await ctx.runMutation(internal.seedIssues._createIssue, {
        title:        TITLES[i % TITLES.length],
        description:  DESCRIPTIONS[i % DESCRIPTIONS.length],
        categoryId:   pick(CATEGORIES),
        districtId:   pick(DISTRICTS),
        priority,
        status,
        address:      pick(ADDRESSES),
        reportedBy:   user.id,
        reporterName: user.name,
        createdAt,
        storageId:    storageId    ?? undefined,
        mediaName:    `site_photo_${i + 1}.jpg`,
        docStorageId: docStorageId ?? undefined,
        docName:      `report_${i + 1}.pdf`,
      });

      // Add 1-3 follow-up notes (60 % with a photo each)
      const noteCount = randInt(1, 3);
      for (let n = 0; n < noteCount; n++) {
        const noteUser = pick(USERS);
        const noteImg  = Math.random() > 0.4 ? await uploadImage(ctx, i * 5 + n + 50) : null;
        await ctx.runMutation(internal.seedIssues._addNote, {
          issueId,
          text:       pick(NOTE_TEXTS),
          authorId:   noteUser.id,
          authorName: noteUser.name,
          timestamp:  createdAt + randInt(1, 14) * 86_400_000,
          storageId:  noteImg ?? undefined,
          mediaName:  noteImg ? `note_${n + 1}.jpg` : undefined,
        });
      }

      log.push(`✅ #${i + 1} "${TITLES[i % TITLES.length]}" [${status} / ${priority}] img=${!!storageId} doc=${!!docStorageId}`);
    }

    return { success: true, deleted, created: 40, log };
  },
});
