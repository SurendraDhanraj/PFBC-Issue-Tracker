import { mutation } from "./_generated/server";
import { v } from "convex/values";

function generateSalt(): string {
  let salt = "";
  for (let i = 0; i < 32; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

function hashPassword(password: string, salt: string): string {
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

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("categories").first();
    if (existing) return { success: false, message: "Already seeded" };

    // Seed categories
    const categories = [
      { name: "Drainage", color: "#3b82f6", icon: "🌊", description: "Blocked drains, flooding, stormwater", sortOrder: 0 },
      { name: "Garbage / Illegal Dumping", color: "#ef4444", icon: "🗑️", description: "Unauthorized dumping, uncollected garbage", sortOrder: 1 },
      { name: "Mosquito / Vector Control", color: "#f59e0b", icon: "🦟", description: "Mosquito breeding, pest infestations", sortOrder: 2 },
      { name: "Food Safety", color: "#8b5cf6", icon: "🍽️", description: "Food handling violations, unsafe premises", sortOrder: 3 },
      { name: "Water Supply", color: "#06b6d4", icon: "💧", description: "Water quality, supply issues", sortOrder: 4 },
      { name: "Animal Control", color: "#f97316", icon: "🐾", description: "Stray animals, animal nuisance", sortOrder: 5 },
      { name: "Environmental Health", color: "#10b981", icon: "🌿", description: "Pollution, environmental hazards", sortOrder: 6 },
      { name: "Noise Complaint", color: "#6b7280", icon: "🔊", description: "Excessive noise, disturbances", sortOrder: 7 },
      { name: "Rodent Control", color: "#7c3aed", icon: "🐀", description: "Rat/mouse infestations", sortOrder: 8 },
      { name: "Public Nuisance", color: "#dc2626", icon: "⚠️", description: "General public health nuisances", sortOrder: 9 },
    ];

    for (const cat of categories) {
      await ctx.db.insert("categories", { ...cat, active: true });
    }

    // Seed leave types
    const leaveTypes = [
      { name: "Annual Leave", description: "Paid annual vacation leave", maxDaysPerYear: 21, sortOrder: 0 },
      { name: "Sick Leave", description: "Medical/health leave", maxDaysPerYear: 14, sortOrder: 1 },
      { name: "Casual Leave", description: "Short notice personal leave", maxDaysPerYear: 7, sortOrder: 2 },
      { name: "Maternity Leave", description: "Leave for childbirth and care", maxDaysPerYear: 90, sortOrder: 3 },
      { name: "Paternity Leave", description: "Leave for new fathers", maxDaysPerYear: 5, sortOrder: 4 },
      { name: "Emergency Leave", description: "Urgent unforeseen circumstances", maxDaysPerYear: 3, sortOrder: 5 },
      { name: "Study Leave", description: "Professional development and exams", maxDaysPerYear: 10, sortOrder: 6 },
    ];

    for (const lt of leaveTypes) {
      await ctx.db.insert("leaveTypes", { ...lt, active: true });
    }

    // Seed initial admin user (Medical Officer of Health)
    const userExists = await ctx.db.query("users").first();
    if (!userExists) {
      const salt = generateSalt();
      const passwordHash = hashPassword("Admin@1234", salt);
      await ctx.db.insert("users", {
        name: "System Administrator",
        email: "admin@pf.health.gov.tt",
        passwordHash,
        salt,
        role: "Medical Officer of Health",
        assignedDistricts: ["ALL"],
        active: true,
        initials: "SA",
        phone: "",
        createdAt: Date.now(),
      });
    }

    return { success: true, message: "Seeded categories, leave types, and admin user" };
  },
});

export const seedIssues = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("issues").first();
    if (existing) return { success: false, message: "Issues already seeded" };

    // Real IDs from the database
    const USERS = {
      moh:   "k576s4c3x55zdvt1z0j5q13pgs84mmn9" as any, // Dr. Surendra Dhanraj
      phi3:  "k574ep55wwd8rst050bc9swdnh8548za" as any,  // Andy Ragoobar
    };
    const CAT = {
      drainage:   "kd7f1f3bq6jnhsmynvfsfag7s184mw98" as any,
      garbage:    "kd79bah4y7x1bn5sdh8wk8bhpn84ng1p" as any,
      mosquito:   "kd71eth9xcfdw31j79nr1m1pqx84mf6z" as any,
      food:       "kd7dybf8ypccprhmen2hc3p00584m14b" as any,
      water:      "kd78jqsd8yf74sahgmsb2swyjn84n9sf" as any,
      animal:     "kd702rw9d5eqvhq3ptbscpb7w984nrbm" as any,
      enviro:     "kd7fq2pd331ttfpnjvrhnf6z0n84nce8" as any,
      noise:      "kd7ak9d5jpp8j0mx07kcmzw74184ndk1" as any,
      rodent:     "kd7akk0f02fz6z1j3xxhth3rd584m8t5" as any,
      nuisance:   "kd74dtyvtc0wr9s840rcrjv07h84n0an" as any,
    };
    const DIST = {
      erin:      "j57fb3rab4jygc9s0zwg1rmhrh84m3nc" as any,
      newVillage:"j57ebpj4r1atp6c85ef5tr6yh984njxx" as any,
      capDeville:"j573t0qan7y1jv4ykej01382ds84n9n9" as any,
      techier:   "j5713j5nytv35w7yyw5xp6xa8d84ne4h" as any,
      egypt:     "j579xsgpwa9r8jjx5cwrcnh2k584nbgq" as any,
      newlands:  "j57ewfgs74jmj2mdg7b5d7w80d84nmvh" as any,
      hollywood: "j57494wbhknfeypmavgsggxvbd84nfjx" as any,
      cedros:    "j57cdhjnpep2hcm554gc91qhqh84mp60" as any,
    };

    const now = Date.now();
    const day = 86_400_000;

    const issues = [
      {
        title: "Blocked drain causing flooding on Erin Main Road",
        description: "Heavy rainfall has caused the main drain on Erin Main Road to overflow. Standing water approx 30cm deep is blocking vehicular and pedestrian traffic. Several homes at risk of flooding.",
        categoryId: CAT.drainage, status: "open", priority: "urgent",
        districtId: DIST.erin, address: "Erin Main Road, near Erin RC School",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "Initial inspection completed. Debris blocking culvert. Requesting heavy equipment.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 2*day }],
        subtasks: [], createdAt: now - 3*day, updatedAt: now - 2*day,
      },
      {
        title: "Illegal garbage dump at Hollywood Village junction",
        description: "Large pile of household and construction waste deposited overnight at the junction of Hollywood Village and La Resource Trace. Approximately 2 truckloads of mixed waste including some medical waste bags observed.",
        categoryId: CAT.garbage, status: "in_progress", priority: "high",
        districtId: DIST.hollywood, address: "Hollywood Village Junction, La Resource Trace",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [{ text: "Warning notice issued to adjacent property owners. Cleanup crew scheduled for Thursday.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 1*day }],
        subtasks: [
          { id: "st1", title: "Issue formal notice to landowner", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day, completedAt: now - 4*day },
          { id: "st2", title: "Arrange cleanup crew", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day },
        ],
        createdAt: now - 5*day, updatedAt: now - 1*day,
      },
      {
        title: "Stagnant water and mosquito breeding in abandoned lot — New Village",
        description: "Vacant lot on Bronte Street, New Village has multiple containers of stagnant water. Residents report high mosquito activity; two confirmed dengue cases in the immediate area this month.",
        categoryId: CAT.mosquito, status: "critical", priority: "urgent",
        districtId: DIST.newVillage, address: "Bronte Street, New Village",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          { text: "Site visit conducted. 14 positive Stegomyia index containers found. Larviciding applied immediately.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 6*day },
          { text: "Linked to two confirmed dengue cases — escalated to MOH.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 5*day },
        ],
        subtasks: [
          { id: "st3", title: "Apply larvicide treatment", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 6*day },
          { id: "st4", title: "Serve abatement notice on landowner", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 5*day },
          { id: "st5", title: "Follow-up inspection in 7 days", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day },
        ],
        createdAt: now - 7*day, updatedAt: now - 5*day,
      },
      {
        title: "Food handler without health certificate at Cairo Street roti shop",
        description: "Spot inspection of roti shop at Cairo Street revealed two food handlers without valid health certificates. Kitchen area found with improper food storage — raw meat stored above ready-to-eat items.",
        categoryId: CAT.food, status: "pending", priority: "high",
        districtId: DIST.egypt, address: "Cairo Street, Egypt Village",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "Improvement notice issued. Owner given 14 days to obtain certificates and correct storage violations.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 10*day }],
        subtasks: [
          { id: "st6", title: "Issue improvement notice", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 10*day, completedAt: now - 10*day },
          { id: "st7", title: "Re-inspection in 14 days", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 10*day },
        ],
        createdAt: now - 10*day, updatedAt: now - 10*day,
      },
      {
        title: "Low water pressure and discoloration — Techier district",
        description: "Residents along Guapo Bay Road and surrounding streets report brown, discoloured water from taps and extremely low pressure for the past 4 days. Some households have no water supply at all.",
        categoryId: CAT.water, status: "in_progress", priority: "high",
        districtId: DIST.techier, address: "Guapo Bay Road, Techier",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [{ text: "WASA notified. Water sample collected for lab analysis. Advisory issued to boil water until results received.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 4*day }],
        subtasks: [],
        createdAt: now - 4*day, updatedAt: now - 4*day,
      },
      {
        title: "Pack of stray dogs attacking pedestrians — Cedros Road",
        description: "At least 6 stray dogs are roaming Cedros Main Road and have bitten two residents within the past week. One victim received hospital treatment. Animals appear aggressive and may be rabid.",
        categoryId: CAT.animal, status: "open", priority: "urgent",
        districtId: DIST.cedros, address: "Cedros Main Road, near Cedros Police Station",
        reportedBy: USERS.phi3, assignedTo: null,
        notes: [],
        subtasks: [],
        createdAt: now - 1*day, updatedAt: now - 1*day,
      },
      {
        title: "Chemical waste discharge into Pt Fortin river — Newlands",
        description: "Dark oily substance observed flowing from an industrial compound into the Newlands river channel. Strong chemical odour. Fish kill noticed downstream. Source suspected to be a vehicle repair workshop.",
        categoryId: CAT.enviro, status: "open", priority: "urgent",
        districtId: DIST.newlands, address: "Mahaica Road, Newlands",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [{ text: "EMA notified. Site secured pending investigation. Water samples taken.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 2*day }],
        subtasks: [],
        createdAt: now - 2*day, updatedAt: now - 2*day,
      },
      {
        title: "Noise complaint — late night music from event venue, Hollywood",
        description: "Residents within a 500m radius of Hollywood Community Centre report excessive amplified music past 2 AM on weekends consistently for the past month. Multiple households affected.",
        categoryId: CAT.noise, status: "resolved", priority: "medium",
        districtId: DIST.hollywood, address: "Hollywood Community Centre, Hollywood Village",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          { text: "Site visit Saturday 11 PM — music levels measured at 92dB. Formal warning issued to organiser.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 14*day },
          { text: "Follow-up check two weekends later — no violation. Issue resolved.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 7*day },
        ],
        subtasks: [],
        createdAt: now - 21*day, updatedAt: now - 7*day,
      },
      {
        title: "Rat infestation reported at Cap-de-Ville market",
        description: "Market vendors and shoppers report large rats active during daylight hours near the produce stalls. Droppings found on food surfaces. Health risk to public and food contamination likely.",
        categoryId: CAT.rodent, status: "in_progress", priority: "high",
        districtId: DIST.capDeville, address: "Cap-de-Ville Market, Cap-de-Ville",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "Poison bait stations placed in 8 locations. Market manager advised to improve storage and seal gaps in structure.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 3*day }],
        subtasks: [
          { id: "st8", title: "Install bait stations", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day, completedAt: now - 3*day },
          { id: "st9", title: "Inspect and replenish bait in 7 days", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day },
        ],
        createdAt: now - 4*day, updatedAt: now - 3*day,
      },
      {
        title: "Derelict building attracting vagrants and waste — Egypt Village",
        description: "Abandoned two-storey concrete building on Cemetery Road has become a gathering point. Resident complaints about burning of refuse, human waste disposal, and late-night disturbance.",
        categoryId: CAT.nuisance, status: "open", priority: "medium",
        districtId: DIST.egypt, address: "Cemetery Road, Egypt Village",
        reportedBy: USERS.moh, assignedTo: null,
        notes: [],
        subtasks: [],
        createdAt: now - 8*day, updatedAt: now - 8*day,
      },
      {
        title: "Drain collapsed under Erin Road causing sinkholes",
        description: "Two sinkholes have formed on the shoulder of Erin Road near the Siparia junction following last week's heavy rains. Subsurface drain confirmed collapsed by visual inspection. Risk to passing vehicles.",
        categoryId: CAT.drainage, status: "in_progress", priority: "urgent",
        districtId: DIST.erin, address: "Erin Road, near Siparia Junction",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [{ text: "TTEC and WASA notified re underground utilities. Barrier erected. Works & Infrastructure referral sent.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 5*day }],
        subtasks: [],
        createdAt: now - 6*day, updatedAt: now - 5*day,
      },
      {
        title: "Uncollected garbage bins overflowing — Newlands district",
        description: "Garbage collection has not occurred in the Newlands/Mahaica area for 3 consecutive scheduled days. Bins are overflowing onto the street. Residents fear increase in vector activity.",
        categoryId: CAT.garbage, status: "closed", priority: "medium",
        districtId: DIST.newlands, address: "La Brea Road, Newlands",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          { text: "SWMCOL contacted — confirmed driver shortage. Committed to priority collection by Friday.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 11*day },
          { text: "Collection completed. Area cleared. Closed.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 9*day },
        ],
        subtasks: [],
        createdAt: now - 12*day, updatedAt: now - 9*day, closedAt: now - 9*day,
      },
      {
        title: "Water main leak flooding Fanny Village residential street",
        description: "Water main has burst on Charles Street, Fanny Village. Water gushing continuously into the road, entering homes on the lower side of the street. Two households evacuated. WASA contacted but no response for 10 hours.",
        categoryId: CAT.water, status: "resolved", priority: "urgent",
        districtId: DIST.capDeville, address: "Charles Street, Fanny Village",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          { text: "Emergency escalation to WASA regional manager. Repair crew arrived 14 hours after initial report.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 15*day },
          { text: "Pipe repaired. Homes dried out. Residents returned. Resolved.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 14*day },
        ],
        subtasks: [],
        createdAt: now - 16*day, updatedAt: now - 14*day,
      },
      {
        title: "Stray cattle on PTSC highway creating traffic hazard — Techier",
        description: "Three cattle have wandered onto the Solomon Hochoy Highway near the Techier/Guapo interchange. They are blocking the southbound lane. Risk of serious vehicular accident. Owner unknown.",
        categoryId: CAT.animal, status: "resolved", priority: "high",
        districtId: DIST.techier, address: "Solomon Hochoy Highway, Techier Interchange",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "TTPS and Animal Control Unit notified. Animals guided off highway by 2 hours. Owner traced and cautioned.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 20*day }],
        subtasks: [],
        createdAt: now - 20*day, updatedAt: now - 20*day,
      },
      {
        title: "Asbestos debris dumped on PTSC bus terminal grounds — New Village",
        description: "Construction site adjacent to the New Village PTSC bus terminal has dumped what appears to be asbestos-containing roofing sheets on the terminal compound. Staff and commuters potentially exposed.",
        categoryId: CAT.enviro, status: "critical", priority: "urgent",
        districtId: DIST.newVillage, address: "PTSC Bus Terminal, New Village Road",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          { text: "Area cordoned off immediately. EMA and OSH Authority notified. Specialised asbestos removal contractor being sourced.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 0.5*day },
        ],
        subtasks: [
          { id: "st10", title: "Cordon off affected area", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 1*day, completedAt: now - 0.5*day },
          { id: "st11", title: "Notify EMA", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 1*day, completedAt: now - 0.5*day },
          { id: "st12", title: "Arrange licensed asbestos removal", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 1*day },
        ],
        createdAt: now - 1*day, updatedAt: now - 0.5*day,
      },
      {
        title: "Industrial noise from quarry affecting Cedros village — night hours",
        description: "Residents of Cedros Village report that a nearby quarry is operating rock-crushing equipment between 10 PM and 4 AM, causing significant sleep disturbance. Vibration has also cracked walls in two adjacent properties.",
        categoryId: CAT.noise, status: "in_progress", priority: "high",
        districtId: DIST.cedros, address: "Cedros Quarry Area, Cedros",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "Monitoring conducted 11 PM–1 AM. Peak reading 87dB at property boundary. Exceeds permitted limits. Stop Order being prepared.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 3*day }],
        subtasks: [],
        createdAt: now - 7*day, updatedAt: now - 3*day,
      },
      {
        title: "Rodent infestation in residential block — Hollywood Heights",
        description: "Four adjacent residences on Heights Crescent, Hollywood report active rat infestations. One resident bitten. Signs of rodent activity in roof space and kitchen walls of multiple units.",
        categoryId: CAT.rodent, status: "open", priority: "high",
        districtId: DIST.hollywood, address: "Heights Crescent, Hollywood Heights",
        reportedBy: USERS.phi3, assignedTo: null,
        notes: [],
        subtasks: [],
        createdAt: now - 0.5*day, updatedAt: now - 0.5*day,
      },
      {
        title: "Derelict vehicle dumped in waterway — Newlands trace",
        description: "An abandoned vehicle has been pushed into the Mahaica river channel near the Newlands trace. It is partially blocking water flow and may cause flooding upstream during heavy rain. Oil visible on water surface.",
        categoryId: CAT.nuisance, status: "open", priority: "medium",
        districtId: DIST.newlands, address: "Mahaica Trace, Newlands",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [{ text: "Referred to TTPS for vehicle tracing. Works & Infrastructure notified for removal. Environmental sample taken.", authorId: USERS.moh, authorName: "Dr. Surendra Dhanraj", timestamp: now - 2*day }],
        subtasks: [],
        createdAt: now - 3*day, updatedAt: now - 2*day,
      },
      {
        title: "Unsanitary conditions at fresh produce stall — Techier market",
        description: "Complaint received re: vendor at Techier road market selling fresh produce from unsanitary surface conditions. No handwashing facilities. Flies observed on exposed food. No food handler badge displayed.",
        categoryId: CAT.food, status: "pending", priority: "medium",
        districtId: DIST.techier, address: "Techier Road Market, Guapo",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [{ text: "Verbal warning issued on-site. Written notice to follow. Vendor instructed to cease operations until compliance.", authorId: USERS.phi3, authorName: "Andy Ragoobar", timestamp: now - 1*day }],
        subtasks: [],
        createdAt: now - 1*day, updatedAt: now - 1*day,
      },
      {
        title: "Main drain blocked by tree roots — Erin Old Road",
        description: "Concrete drain on Erin Old Road is 70% blocked by tree roots from an adjacent silk-cotton tree. After moderate rainfall the road fills completely. No alternate access for residents along that stretch.",
        categoryId: CAT.drainage, status: "open", priority: "medium",
        districtId: DIST.erin, address: "Erin Old Road, Erin Village",
        reportedBy: USERS.phi3, assignedTo: null,
        notes: [],
        subtasks: [],
        createdAt: now - 2*day, updatedAt: now - 2*day,
      },
    ];

    let count = 0;
    for (const issue of issues) {
      const { closedAt, assignedTo, ...rest } = issue as any;
      const doc: any = { ...rest };
      if (assignedTo !== null && assignedTo !== undefined) doc.assignedTo = assignedTo;
      if (closedAt) doc.closedAt = closedAt;
      await ctx.db.insert("issues", doc);
      count++;
    }

    return { success: true, message: `Seeded ${count} issues` };
  },
});

export const seedIssues2 = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("issues").collect();
    if (all.length >= 40) return { success: false, message: "Already have plenty of issues" };

    const USERS = {
      moh:  "k576s4c3x55zdvt1z0j5q13pgs84mmn9" as any,
      phi3: "k574ep55wwd8rst050bc9swdnh8548za"  as any,
    };
    const CAT = {
      drainage:   "kd7f1f3bq6jnhsmynvfsfag7s184mw98" as any,
      garbage:    "kd79bah4y7x1bn5sdh8wk8bhpn84ng1p" as any,
      mosquito:   "kd71eth9xcfdw31j79nr1m1pqx84mf6z" as any,
      food:       "kd7dybf8ypccprhmen2hc3p00584m14b" as any,
      water:      "kd78jqsd8yf74sahgmsb2swyjn84n9sf" as any,
      animal:     "kd702rw9d5eqvhq3ptbscpb7w984nrbm" as any,
      enviro:     "kd7fq2pd331ttfpnjvrhnf6z0n84nce8" as any,
      noise:      "kd7ak9d5jpp8j0mx07kcmzw74184ndk1" as any,
      rodent:     "kd7akk0f02fz6z1j3xxhth3rd584m8t5" as any,
      nuisance:   "kd74dtyvtc0wr9s840rcrjv07h84n0an" as any,
    };
    const DIST = {
      erin:      "j57fb3rab4jygc9s0zwg1rmhrh84m3nc" as any,
      newVillage:"j57ebpj4r1atp6c85ef5tr6yh984njxx" as any,
      capDeville:"j573t0qan7y1jv4ykej01382ds84n9n9" as any,
      techier:   "j5713j5nytv35w7yyw5xp6xa8d84ne4h" as any,
      egypt:     "j579xsgpwa9r8jjx5cwrcnh2k584nbgq" as any,
      newlands:  "j57ewfgs74jmj2mdg7b5d7w80d84nmvh" as any,
      hollywood: "j57494wbhknfeypmavgsggxvbd84nfjx" as any,
      cedros:    "j57cdhjnpep2hcm554gc91qhqh84mp60" as any,
    };

    // Demo image URLs (served from public/demo/)
    const IMG = {
      drain:    "/demo/drain_flooding.png",
      dump:     "/demo/illegal_dump.png",
      mosquito: "/demo/mosquito_breeding.png",
      food:     "/demo/food_inspection.png",
      rodent:   "/demo/rodent_damage.png",
      river:    "/demo/river_pollution.png",
      report:   "/demo/inspection_report.png",
      dogs:     "/demo/stray_dogs.png",
    };

    const now = Date.now();
    const day = 86_400_000;

    const note = (text: string, author: "moh"|"phi3", daysAgo: number, media?: {url:string; type:string; name:string}) => ({
      text,
      authorId: USERS[author],
      authorName: author === "moh" ? "Dr. Surendra Dhanraj" : "Andy Ragoobar",
      timestamp: now - daysAgo * day,
      ...(media ? { mediaUrl: media.url, mediaType: media.type, mediaName: media.name } : {}),
    });

    const img = (url: string, name: string) => ({ url, type: "image/png", name });
    const doc = (url: string, name: string) => ({ url, type: "application/pdf", name });

    const issues: any[] = [
      {
        title: "Major drain overflow flooding Erin playing field",
        description: "The main culvert adjacent to the Erin playing field has completely collapsed, causing a large section of the recreational area and access road to flood. Water depth is approximately 60cm. The area has been inaccessible for three days and a child's bicycle was swept away. Works & Infrastructure have been notified but no response as yet.",
        categoryId: CAT.drainage, status: "critical", priority: "urgent",
        districtId: DIST.erin, address: "Erin Playing Field, Erin Road",
        reportedBy: USERS.phi3, assignedTo: USERS.moh,
        notes: [
          note("Site photographed. Culvert has completely failed — approximately 2m section collapsed.", "phi3", 2, img(IMG.drain, "erin_drain_collapse.png")),
          note("Emergency referral submitted to Works & Infrastructure. EMA on standby. Area cordoned off with temporary barriers.", "moh", 1),
        ],
        subtasks: [
          { id: "i2s1", title: "Cordon off flooded area", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 3*day, completedAt: now - 2*day },
          { id: "i2s2", title: "Submit emergency referral to W&I", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 3*day, completedAt: now - 1*day },
          { id: "i2s3", title: "Follow up W&I — confirm repair timeline", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 3*day },
        ],
        createdAt: now - 3*day, updatedAt: now - 1*day,
      },
      {
        title: "Household waste dumped along Cedros North Road overnight",
        description: "Approximately 3 tonnes of mixed household and construction waste have been fly-tipped along the shoulder of Cedros North Road near the La Lune junction. The dump includes old furniture, broken appliances, and construction debris. The material is blocking the road shoulder and creates a hazard to cyclists.",
        categoryId: CAT.garbage, status: "in_progress", priority: "high",
        districtId: DIST.cedros, address: "Cedros North Road, La Lune Junction",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Evidence photographed on site. Registrations of vehicles observed in area obtained from TTPS CCTV request.", "phi3", 4, img(IMG.dump, "cedros_dump_site.png")),
          note("Formal notice posted at site. SWMCOL contacted for priority clean-up. Investigating vehicle owners.", "phi3", 3),
          note("Compliance inspection report attached regarding adjacent property owners.", "moh", 2, doc(IMG.report, "Notice_Cedros_FlyTipping_Report.pdf")),
        ],
        subtasks: [
          { id: "i2s4", title: "Post notice at site", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day, completedAt: now - 4*day },
          { id: "i2s5", title: "Contact SWMCOL for cleanup", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day, completedAt: now - 3*day },
          { id: "i2s6", title: "Identify and prosecute offenders", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 5*day },
        ],
        createdAt: now - 5*day, updatedAt: now - 2*day,
      },
      {
        title: "Dengue alert — multiple positive breeding containers in Newlands",
        description: "Following the recent dengue cluster in the Newlands/Mahaica area, a sweep of the neighbourhood identified 22 positive containers out of 94 inspected. Stegomyia Index stands at 23.4% — well above the 5% intervention threshold. Immediate region-wide larviciding and source reduction required.",
        categoryId: CAT.mosquito, status: "critical", priority: "urgent",
        districtId: DIST.newlands, address: "Newlands / Mahaica — district-wide",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Site survey completed for Block 3 of Newlands. Photo evidence of key breeding sites.", "phi3", 6, img(IMG.mosquito, "newlands_breeding_survey.png")),
          note("Larviciding round 1 completed — 94 premises treated. Abatement notices issued to 12 property owners.", "phi3", 5),
          note("Formal health alert issued to the community. Clinic notified to expect increased dengue presentations.", "moh", 4),
          note("Round 2 larviciding underway. Inspection report attached.", "moh", 2, doc(IMG.report, "Newlands_Vector_Report_Apr2026.pdf")),
        ],
        subtasks: [
          { id: "i2s7", title: "Complete block-by-block breeding survey", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 6*day },
          { id: "i2s8", title: "Larviciding round 1 — all blocks", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 5*day },
          { id: "i2s9", title: "Larviciding round 2", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day },
          { id: "i2s10", title: "7-day follow-up re-inspection", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day },
        ],
        createdAt: now - 10*day, updatedAt: now - 2*day,
      },
      {
        title: "Food safety violation — unlicensed food processing at Egypt residential property",
        description: "Complaint received that a residential property on Cairo Extension is operating an unlicensed food processing and distribution unit. Meat products (black pudding, smoked pork) reportedly being processed in a domestic kitchen and sold commercially. No food handler certificates, no TTBS registration, no Food and Drugs licence.",
        categoryId: CAT.food, status: "pending", priority: "high",
        districtId: DIST.egypt, address: "Cairo Extension, Egypt Village",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Unannounced inspection conducted 6 AM. Found active food processing with no PPE, raw meat on uncovered benches, no handwashing facility. Three workers present — none with health certificates.", "phi3", 8, img(IMG.food, "egypt_food_inspection.png")),
          note("Premises closed and sealed pending compliance. Formal improvement notice and closure order served. Owner cautioned.", "phi3", 7),
          note("Official closure notice attached for records.", "moh", 7, doc(IMG.report, "Closure_Order_Egypt_FoodProcessor.pdf")),
        ],
        subtasks: [
          { id: "i2s11", title: "Conduct unannounced inspection", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 10*day, completedAt: now - 8*day },
          { id: "i2s12", title: "Serve formal closure order", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 10*day, completedAt: now - 7*day },
          { id: "i2s13", title: "Re-inspection for compliance 21 days", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 10*day },
        ],
        createdAt: now - 12*day, updatedAt: now - 7*day,
      },
      {
        title: "Water supply contamination — Techier/Guapo — E. coli detected",
        description: "Lab results from WASA confirm E. coli presence in samples taken from three separate tap water outlets in the Techier/Guapo district following resident complaints of stomach illness. Three families have been hospitalised. The local water main is suspected of a cross-contamination event due to a burst sewer line nearby.",
        categoryId: CAT.water, status: "critical", priority: "urgent",
        districtId: DIST.techier, address: "Guapo Bay Road and surrounds, Techier",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Lab confirmation report received — E. coli positive at 3 sites. Do Not Drink advisory immediately issued.", "moh", 3, doc(IMG.report, "WASA_Lab_Result_Techier_Apr2026.pdf")),
          note("Water trucking arranged for affected 140 households. Coordinating with WASA on emergency main repair.", "moh", 2),
          note("District-wide door-to-door notification completed. Hospital liaison for the 3 hospitalised patients underway.", "phi3", 1),
        ],
        subtasks: [
          { id: "i2s14", title: "Issue Do Not Drink advisory", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 4*day, completedAt: now - 3*day },
          { id: "i2s15", title: "Arrange emergency water trucking", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 4*day, completedAt: now - 2*day },
          { id: "i2s16", title: "Coordinate WASA sewer and main repair", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 4*day },
          { id: "i2s17", title: "Follow-up water sampling post-repair", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day },
        ],
        createdAt: now - 4*day, updatedAt: now - 1*day,
      },
      {
        title: "Pack of stray dogs — repeat incidents, two bites — Hollywood Heights area",
        description: "The pack of stray dogs roaming Hollywood Heights has now bitten four residents in the past month. Two victims required suturing at PFBGH. Animal Control has been contacted twice with no response. The alpha dog in the pack, a large brown male, appears to have a leg wound which may be causing aggression.",
        categoryId: CAT.animal, status: "in_progress", priority: "urgent",
        districtId: DIST.hollywood, address: "Heights Crescent and surrounding streets, Hollywood Heights",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Pack photographed at 7 AM near Heights Crescent. Six dogs — mix of large breeds. One dog clearly injured.", "phi3", 5, img(IMG.dogs, "hollywood_strays_7am.png")),
          note("Formal complaint filed with Animal Control Division, Agriculture Ministry. Referenced bite victims for urgency. Awaiting response.", "phi3", 4),
          note("Residents advised to avoid the area between 6–9 AM and 5–7 PM when pack is most active. PFBGH notified of potential rabies risk.", "moh", 3),
        ],
        subtasks: [
          { id: "i2s18", title: "Document and report all incidents to Animal Control", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 6*day, completedAt: now - 4*day },
          { id: "i2s19", title: "Follow up Animal Control for trapping date", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 6*day },
          { id: "i2s20", title: "Check bite victims' rabies prophylaxis status", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 6*day },
        ],
        createdAt: now - 8*day, updatedAt: now - 3*day,
      },
      {
        title: "Oil spill — Cedros coastline near fishing facility",
        description: "Fishermen and coastal residents report a large oil slick extending approximately 400m along the Cedros coastline south of the fishing depot. The source is suspected to be a bunkering vessel anchored offshore. Dead birds and fish observed on the beach. Odour is severe. The local fishing industry is at risk.",
        categoryId: CAT.enviro, status: "critical", priority: "urgent",
        districtId: DIST.cedros, address: "Cedros Coastline, south of fishing depot",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Aerial drone footage and shoreline photos taken. Oil confirmed — thick, dark crude-type. Dead wildlife present.", "phi3", 2, img(IMG.river, "cedros_oil_spill_coastline.png")),
          note("EMA, Coast Guard, PURE notified. Oil spill response team requested. Area closed to fishing.", "moh", 1),
          note("Incident report filed — initial environmental assessment attached.", "moh", 1, doc(IMG.report, "Cedros_OilSpill_IncidentReport.pdf")),
        ],
        subtasks: [
          { id: "i2s21", title: "Notify EMA and Coast Guard", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 3*day, completedAt: now - 1*day },
          { id: "i2s22", title: "Close area to fishing — enforce exclusion", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 3*day, completedAt: now - 1*day },
          { id: "i2s23", title: "Monitor wildlife mortality daily", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 3*day },
        ],
        createdAt: now - 3*day, updatedAt: now - 1*day,
      },
      {
        title: "Illegal quarrying operation — night hours — New Village boundary",
        description: "An unlicensed quarrying or excavation operation is reportedly running between 11 PM and 4 AM on undeveloped land near the New Village/Cap-de-Ville boundary. Residents report heavy machinery, blasting sounds, and bright lights. When inspectors arrived at 7 AM the site was cleared but fresh earth disturbance was evident.",
        categoryId: CAT.noise, status: "in_progress", priority: "high",
        districtId: DIST.newVillage, address: "Eastern boundary of New Village, near Cap-de-Ville road",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Night monitoring conducted 10 PM–2 AM. Heavy machinery confirmed active at 11:40 PM. Video footage obtained. Sound levels 94dB at property line.", "phi3", 6),
          note("TTPS notified with footage. Lands and Surveys alerted. Seeking identity of land operator/lessee.", "phi3", 5),
          note("Formal noise complaint and site disturbance report filed. Document attached.", "moh", 4, doc(IMG.report, "Illegal_Quarry_Complaint_NewVillage.pdf")),
        ],
        subtasks: [
          { id: "i2s24", title: "Conduct night surveillance — obtain evidence", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 6*day },
          { id: "i2s25", title: "Report to TTPS and Lands & Surveys", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 7*day, completedAt: now - 5*day },
          { id: "i2s26", title: "Obtain identity of operator and serve stop notice", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 7*day },
        ],
        createdAt: now - 9*day, updatedAt: now - 4*day,
      },
      {
        title: "Rodent infestation — Cap-de-Ville School canteen",
        description: "The canteen operator at Cap-de-Ville Government Primary School has reported active rodent infestation in the canteen preparation area. Rat droppings found in dry goods storage, gnaw marks on packaging. Two food handlers have raised concern about safety. The canteen has been temporarily closed pending inspection.",
        categoryId: CAT.rodent, status: "pending", priority: "high",
        districtId: DIST.capDeville, address: "Cap-de-Ville Government Primary School, Cap-de-Ville",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Canteen inspection completed. Extensive droppings in dry storage area. Gnaw marks on bags of flour and rice. Bait stations installed in 6 locations. All contaminated stock removed.", "phi3", 3, img(IMG.rodent, "capdeville_school_canteen_rodents.png")),
          note("Canteen advised to seal all structural gaps before reopening. Canteen operator provided with compliance checklist.", "phi3", 2),
          note("PHO compliance report and closure checklist attached.", "moh", 1, doc(IMG.report, "CapDeVille_School_Rodent_Report.pdf")),
        ],
        subtasks: [
          { id: "i2s27", title: "Complete canteen inspection", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day, completedAt: now - 3*day },
          { id: "i2s28", title: "Remove all contaminated stock", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day, completedAt: now - 3*day },
          { id: "i2s29", title: "Verify structural gap sealing before reopening", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day },
        ],
        createdAt: now - 5*day, updatedAt: now - 1*day,
      },
      {
        title: "Derelict property overrun with vegetation and vermin — Erin old main road",
        description: "A long-abandoned two-storey property on Erin Old Main Road has become severely overgrown and is confirmed to be harbouring rat colonies and providing a mosquito breeding environment. The property has no identifiable owner. Neighbours report nightly rat activity and persistent mosquito nuisance emanating from the site.",
        categoryId: CAT.nuisance, status: "open", priority: "medium",
        districtId: DIST.erin, address: "Erin Old Main Road, Erin Village",
        reportedBy: USERS.phi3, assignedTo: USERS.moh,
        notes: [
          note("Site inspected. Property completely derelict — vegetation over 2m tall. Multiple active rat burrows confirmed. 8 positive mosquito breeding containers found in overgrown yard.", "phi3", 10),
        ],
        subtasks: [],
        createdAt: now - 11*day, updatedAt: now - 10*day,
      },
      {
        title: "Flooding — Hollywood Low-Lying Street — repeated event",
        description: "The third flooding event this rainy season for the low-lying section of Trace No. 7, Hollywood. Houses on both sides of the trace floor out after any rainfall exceeding 25mm. The same drain has been reported blocked for over two years with no permanent fix. Three families are at risk, one elderly resident cannot evacuate without assistance.",
        categoryId: CAT.drainage, status: "open", priority: "high",
        districtId: DIST.hollywood, address: "Trace No. 7, Hollywood Village",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Third flood event of the season. Photographed at peak inundation — approximately 45cm water depth inside home of elderly resident, Mr. A. The elderly resident evacuated to neighbour.", "phi3", 0.5, img(IMG.drain, "hollywood_trace7_flooding.png")),
        ],
        subtasks: [
          { id: "i2s30", title: "Assist elderly resident evacuation", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 1*day, completedAt: now - 0.5*day },
          { id: "i2s31", title: "Submit priority drain clearance to W&I", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 1*day },
        ],
        createdAt: now - 1*day, updatedAt: now - 0.5*day,
      },
      {
        title: "Illegal dumping of paint and solvent waste — Newlands industrial area",
        description: "Multiple drums of what appear to be waste paint and chemical solvents have been abandoned on vacant land adjacent to the Newlands industrial estate. Strong chemical fumes observed. Ground staining suggests leakage has already begun. Located 200m from a residential water well.",
        categoryId: CAT.enviro, status: "open", priority: "urgent",
        districtId: DIST.newlands, address: "Newlands Industrial Estate boundary, Mahaica Road",
        reportedBy: USERS.phi3, assignedTo: USERS.moh,
        notes: [
          note("Site assessment completed. 14 drums — mixed sizes, unlabelled. Ground contamination visible over approximately 30m². Located 180m from community standpipe.", "phi3", 1, img(IMG.river, "newlands_chemical_drums.png")),
        ],
        subtasks: [
          { id: "i2s32", title: "Notify EMA hazmat team", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 1*day },
          { id: "i2s33", title: "Test nearby water well", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 1*day },
        ],
        createdAt: now - 1*day, updatedAt: now - 1*day,
      },
      {
        title: "Market food vendor — expired food handler certificate and improper refrigeration",
        description: "During routine market inspection at the Cap-de-Ville market, vendor in stall 14 was found operating with an expired food handler's certificate (expired 8 months ago) and selling poultry products stored at ambient temperature. Internal temperature of chicken pieces measured at 18°C — well above safe holding temperature of 4°C.",
        categoryId: CAT.food, status: "resolved", priority: "high",
        districtId: DIST.capDeville, address: "Cap-de-Ville Market, Stall 14",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Inspection completed. All poultry stock seized and destroyed as unfit. Vendor's certificate expired Jan 2026. Immediate suspension of operations issued.", "phi3", 15, img(IMG.food, "capdeville_market_inspection.png")),
          note("Re-inspection 14 days later — vendor produced valid updated certificate. Refrigeration unit functioning at 3°C. Operations permitted to resume.", "phi3", 1),
          note("Official reinstatement certificate and inspection report for records.", "moh", 1, doc(IMG.report, "CapDeVille_Market_Stall14_Clearance.pdf")),
        ],
        subtasks: [
          { id: "i2s34", title: "Seize and destroy non-compliant stock", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 16*day, completedAt: now - 15*day },
          { id: "i2s35", title: "14-day re-inspection", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 16*day, completedAt: now - 1*day },
        ],
        createdAt: now - 17*day, updatedAt: now - 1*day,
      },
      {
        title: "Burst water main — Erin Bypass flooding carriageway",
        description: "A 6-inch water main on the Erin Bypass has burst, flooding the southbound carriageway with a continuous gush estimated at 3000 gallons per hour. Traffic is being diverted. The burst main is also undermining the road embankment. WASA contacted — 4 hour response estimate given.",
        categoryId: CAT.water, status: "in_progress", priority: "urgent",
        districtId: DIST.erin, address: "Erin Bypass, near the old cane fields turnoff",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Road section closed. Bypass cordoned. TTPS managing traffic diversion. WASA crew ETA 2 hours.", "phi3", 0.3),
        ],
        subtasks: [
          { id: "i2s36", title: "Traffic diversion in place", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 1*day, completedAt: now - 0.3*day },
          { id: "i2s37", title: "WASA emergency repair", completed: false, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 1*day },
        ],
        createdAt: now - 0.5*day, updatedAt: now - 0.3*day,
      },
      {
        title: "Night market creating noise, waste, and food hazard — Egypt main road",
        description: "An informal night food market operating every Friday and Saturday on Egypt Main Road from 9 PM to 3 AM is generating persistent complaints. Issues include excessive amplified music, litter spread across the road, uncollected food waste, and vendors without health certificates. A resident reported a case of food poisoning following an event.",
        categoryId: CAT.noise, status: "in_progress", priority: "medium",
        districtId: DIST.egypt, address: "Egypt Main Road, near Egypt junction",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Night inspection conducted. 11 food vendors — only 3 with valid certificates. Open food storage, no handwashing stations. Noise measured at 89dB. Market operator cautioned.", "phi3", 8, img(IMG.food, "egypt_nightmarket_inspection.png")),
          note("Second inspection — modest improvement. 7 vendors now certificated. Still no handwashing. Stop Order served for next event if not compliant.", "phi3", 1),
        ],
        subtasks: [],
        createdAt: now - 10*day, updatedAt: now - 1*day,
      },
      {
        title: "Illegal dog fighting — animal welfare and public health report — Techier",
        description: "Confidential informant alleges regular dog fighting events on an undisclosed property in Techier. Injured dogs left in public spaces have been observed. Two severely injured animals found on Guapo Bay road. Public health risk from dog bites to bystanders and potential spread of disease. Coordination with TTPS and TTSPCA required.",
        categoryId: CAT.animal, status: "open", priority: "high",
        districtId: DIST.techier, address: "Guapo Bay area, Techier (exact location TBC)",
        reportedBy: USERS.moh, assignedTo: USERS.moh,
        notes: [
          note("Confidential report received. Two injured dogs photographed and brought to animal shelter. Both dogs had fresh laceration-type wounds consistent with fighting. TTPS Major Crimes notified.", "moh", 2, img(IMG.dogs, "techier_injured_dogs.png")),
        ],
        subtasks: [
          { id: "i2s38", title: "File formal report with TTPS", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 3*day, completedAt: now - 2*day },
          { id: "i2s39", title: "Coordinate with TTSPCA", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 3*day },
        ],
        createdAt: now - 3*day, updatedAt: now - 2*day,
      },
      {
        title: "Sewage overflow from broken manhole — New Village",
        description: "Raw sewage has been overflowing from a cracked manhole cover on Providence Street, New Village since Tuesday. The overflow is running directly into the nearby storm drain that discharges to the coast. Strong faecal odour affects multiple homes. WASA alerted but no repair crew dispatched in 72 hours.",
        categoryId: CAT.enviro, status: "open", priority: "urgent",
        districtId: DIST.newVillage, address: "Providence Street, New Village",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Inspection confirmed active sewage overflow. Storm drain now dark brown with faecal matter running toward coast about 80m. Health advisory issued to nearby residents — no contact with water.", "phi3", 1, img(IMG.river, "new_village_sewage.png")),
        ],
        subtasks: [
          { id: "i2s40", title: "Emergency WASA notification (follow up)", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 2*day, completedAt: now - 1*day },
          { id: "i2s41", title: "Advisory to residents — avoid contact", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 2*day, completedAt: now - 1*day },
          { id: "i2s42", title: "Water sample from coastal discharge point", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 2*day },
        ],
        createdAt: now - 2*day, updatedAt: now - 1*day,
      },
      {
        title: "Dead cattle on public road — Cedros Junction",
        description: "A dead cattle carcass is lying on the shoulder of the Cedros Junction roundabout. The animal appears to have been there for over 24 hours. Severe odour is affecting a 300m radius. Flies and scavenging birds present. The decomposing carcass poses a risk of disease spread and is near a primary school.",
        categoryId: CAT.animal, status: "resolved", priority: "high",
        districtId: DIST.cedros, address: "Cedros Junction Roundabout",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Carcass confirmed at site — estimated 24–36 hours decomposed. Located 40m from Cedros RC Primary School entrance. TTAP and Municipal Corporation notified for emergency removal.", "phi3", 5),
          note("Carcass removed and site disinfected. Chlorine wash applied. Road reopened. Owner being traced.", "phi3", 4),
        ],
        subtasks: [
          { id: "i2s43", title: "Emergency removal by TTAP/Corporation", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 6*day, completedAt: now - 4*day },
          { id: "i2s44", title: "Disinfect site", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 6*day, completedAt: now - 4*day },
        ],
        createdAt: now - 7*day, updatedAt: now - 4*day,
      },
      {
        title: "Mass spray campaign request — Hollywood District — dengue prevention",
        description: "Following three confirmed dengue cases in Hollywood within a 10-day period, the Hollywood Community Development Council has formally requested a mass adulticiding spray campaign for the district. Recommendation is to conduct a two-round campaign over 14 days, covering all streets and residential areas.",
        categoryId: CAT.mosquito, status: "pending", priority: "high",
        districtId: DIST.hollywood, address: "Hollywood Village — all streets",
        reportedBy: USERS.moh, assignedTo: USERS.phi3,
        notes: [
          note("Dengue cluster confirmed by EPIDEMIOLOGY UNIT. 3 confirmed in Hollywood, 1 suspect. Vector Focal Point briefed. Mass spray campaign recommended — requires MOH sign-off and equipment booking.", "phi3", 4),
          note("Campaign request formalised and submitted to Vector Control Unit. Spray equipment and personnel booked for next available slot.", "moh", 2, doc(IMG.report, "Hollywood_Spray_Campaign_Request.pdf")),
        ],
        subtasks: [
          { id: "i2s45", title: "Epidemiology investigation — link cases", completed: true, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day, completedAt: now - 4*day },
          { id: "i2s46", title: "Submit mass spray request to Vector Control", completed: true, assignedTo: USERS.moh, assignedName: "Dr. Surendra Dhanraj", createdAt: now - 5*day, completedAt: now - 2*day },
          { id: "i2s47", title: "Confirm spray campaign execution date", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day },
          { id: "i2s48", title: "Post-campaign re-inspection", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 5*day },
        ],
        createdAt: now - 6*day, updatedAt: now - 2*day,
      },
      {
        title: "Open drain filled with construction debris — Newlands New Road",
        description: "Contractors working on a housing development on Newlands New Road have been filling the open roadside drain with construction rubble, concrete chunks, and broken masonry. The drain is now 80% blocked over a 60m stretch. The drain serves six properties and its failure will cause flooding of three homes in the rainy season.",
        categoryId: CAT.drainage, status: "open", priority: "medium",
        districtId: DIST.newlands, address: "Newlands New Road, Newlands",
        reportedBy: USERS.phi3, assignedTo: USERS.phi3,
        notes: [
          note("Site documented with photographs. Contractor's signage noted on site — formal notice being prepared for developer and site foreman.", "phi3", 3, img(IMG.drain, "newlands_blocked_drain_construction.png")),
        ],
        subtasks: [
          { id: "i2s49", title: "Issue formal notice to developer", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day },
          { id: "i2s50", title: "Re-inspection — confirm drain cleared", completed: false, assignedTo: USERS.phi3, assignedName: "Andy Ragoobar", createdAt: now - 4*day },
        ],
        createdAt: now - 4*day, updatedAt: now - 3*day,
      },
    ];

    let count = 0;
    for (const issue of issues) {
      const { assignedTo, ...rest } = issue;
      const doc: any = { ...rest };
      if (assignedTo) doc.assignedTo = assignedTo;
      await ctx.db.insert("issues", doc);
      count++;
    }
    return { success: true, message: `Seeded ${count} more issues with media` };
  },
});

