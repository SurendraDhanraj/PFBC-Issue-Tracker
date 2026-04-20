import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Static seed data ─────────────────────────────────────────────────────────
const CATEGORIES = [
  "kd7f1f3bq6jnhsmynvfsfag7s184mw98",
  "kd79bah4y7x1bn5sdh8wk8bhpn84ng1p",
  "kd71eth9xcfdw31j79nr1m1pqx84mf6z",
  "kd7dybf8ypccprhmen2hc3p00584m14b",
  "kd78jqsd8yf74sahgmsb2swyjn84n9sf",
  "kd702rw9d5eqvhq3ptbscpb7w984nrbm",
  "kd7fq2pd331ttfpnjvrhnf6z0n84nce8",
  "kd7ak9d5jpp8j0mx07kcmzw74184ndk1",
  "kd7akk0f02fz6z1j3xxhth3rd584m8t5",
  "kd74dtyvtc0wr9s840rcrjv07h84n0an",
];

const DISTRICTS = [
  "j57fb3rab4jygc9s0zwg1rmhrh84m3nc",
  "j57ebpj4r1atp6c85ef5tr6yh984njxx",
  "j573t0qan7y1jv4ykej01382ds84n9n9",
  "j5713j5nytv35w7yyw5xp6xa8d84ne4h",
  "j579xsgpwa9r8jjx5cwrcnh2k584nbgq",
  "j57ewfgs74jmj2mdg7b5d7w80d84nmvh",
  "j57494wbhknfeypmavgsggxvbd84nfjx",
  "j57cdhjnpep2hcm554gc91qhqh84mp60",
];

const USERS: Array<{ id: string; name: string }> = [
  { id: "k576s4c3x55zdvt1z0j5q13pgs84mmn9", name: "Dr. Surendra Dhanraj" },
  { id: "k574ep55wwd8rst050bc9swdnh8548za",  name: "Andy Ragoobar" },
  { id: "k57b3pzdyex58jkcp43dfbdzy9855987",  name: "Ria Pearie-Braithwaite" },
  { id: "k57bj43nqadf1ka43bd80q87d9854qgs",  name: "Sasha Ramlogan" },
  { id: "k578zcj26e5yyqvcnp8h8gq34n85486t",  name: "Sherwin Bacchus" },
  { id: "k57amfzew0t36qz017s5yenwwx8547dn",  name: "Tricia Khan Moonesar" },
  { id: "k57cbd83ssnxvp0svq5cv1zzv5855r57",  name: "Farrah Roberts" },
];

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
    title:       v.string(),
    description: v.string(),
    categoryId:  v.id("categories"),
    districtId:  v.id("districts"),
    priority:    v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    status:      v.union(
      v.literal("open"), v.literal("in_progress"), v.literal("pending"),
      v.literal("resolved"), v.literal("closed"), v.literal("critical")
    ),
    address:     v.string(),
    reportedBy:  v.id("users"),
    createdAt:   v.number(),
    storageId:   v.optional(v.id("_storage")),
    mediaName:   v.optional(v.string()),
    docStorageId:v.optional(v.id("_storage")),
    docName:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const note: any = {
      text:       "Issue logged via field inspection.",
      authorId:   args.reportedBy,
      authorName: USERS.find(u => u.id === args.reportedBy)?.name ?? "Inspector",
      timestamp:  args.createdAt,
    };
    if (args.storageId) {
      note.storageId = args.storageId;
      note.mediaType = "image";
      note.mediaName = args.mediaName ?? "photo.jpg";
    }

    const docNote: any | null = args.docStorageId
      ? {
          text:      "Inspection report attached.",
          authorId:  args.reportedBy,
          authorName:USERS.find(u => u.id === args.reportedBy)?.name ?? "Inspector",
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
      note.mediaType = "image";
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

    // 1. Wipe existing issues
    const deleted: number = await ctx.runMutation(internal.seedIssues._deleteAllIssues, {});

    const log: string[] = [`🗑️  Deleted ${deleted} existing issues`];

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
        title:       TITLES[i % TITLES.length],
        description: DESCRIPTIONS[i % DESCRIPTIONS.length],
        categoryId:  pick(CATEGORIES) as any,
        districtId:  pick(DISTRICTS)  as any,
        priority,
        status,
        address:     pick(ADDRESSES),
        reportedBy:  user.id as any,
        createdAt,
        storageId:   storageId   ?? undefined,
        mediaName:   `site_photo_${i + 1}.jpg`,
        docStorageId:docStorageId ?? undefined,
        docName:     `report_${i + 1}.pdf`,
      });

      // Add 1-3 follow-up notes (60 % with a photo each)
      const noteCount = randInt(1, 3);
      for (let n = 0; n < noteCount; n++) {
        const noteUser = pick(USERS);
        const noteImg  = Math.random() > 0.4 ? await uploadImage(ctx, i * 5 + n + 50) : null;
        await ctx.runMutation(internal.seedIssues._addNote, {
          issueId,
          text:       pick(NOTE_TEXTS),
          authorId:   noteUser.id as any,
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
