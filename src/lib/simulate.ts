import { db } from "./db";
import { PROVIDERS } from "./config";
import type { ProviderCode } from "./types";

// Synthetic data + simulation engine.
//
// Everything here is MOCK data for the hackathon. No real customer, agent, or
// account is referenced. The generator produces a realistic multi-provider
// super-agent network across Dhaka, then four scenarios (A/B/C/D) that the
// hackathon asks us to demonstrate.

const DHAKA_AGENTS = [
  { code: "AG-KAR-001", name: "Karwan Bazar Super Point", owner: "Karim Sheikh", area: "Karwan Bazar", thana: "Tejgaon", district: "Dhaka", lat: 23.7513, lng: 90.3932 },
  { code: "AG-GUL-002", name: "Gulshan Mobile Mart", owner: "Helal Uddin", area: "Gulshan", thana: "Gulshan", district: "Dhaka", lat: 23.7806, lng: 90.4193 },
  { code: "AG-DHM-003", name: "Dhanmondi Cash Desk", owner: "Rina Akter", area: "Dhanmondi", thana: "Dhanmondi", district: "Dhaka", lat: 23.7466, lng: 90.3766 },
  { code: "AG-MIR-004", name: "Mirpur Quick Serve", owner: "Joynal Abedin", area: "Mirpur", thana: "Mirpur", district: "Dhaka", lat: 23.8068, lng: 90.3679 },
  { code: "AG-MHP-005", name: "Mohammadpur Pay Point", owner: "Shahana Begum", area: "Mohammadpur", thana: "Mohammadpur", district: "Dhaka", lat: 23.7586, lng: 90.3623 },
  { code: "AG-UTT-006", name: "Uttara Express Hub", owner: "Faisal Mahmud", area: "Uttara", thana: "Uttara", district: "Dhaka", lat: 23.8728, lng: 90.3984 },
];

const TXN_TYPES = ["cashin", "cashout", "cashin", "cashout", "transfer_in"];
const CASH_TYPES = new Set(["cashin", "transfer_in"]);

let seeded = false;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function cusId() {
  return "CUS-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}
function nowMinus(min: number) {
  return new Date(Date.now() - min * 60 * 1000);
}

export async function isSeeded() {
  if (seeded) return true;
  const c = await db.provider.count();
  seeded = c > 0;
  return seeded;
}

export async function resetDatabase() {
  await db.caseEvent.deleteMany();
  await db.case.deleteMany();
  await db.alert.deleteMany();
  await db.transaction.deleteMany();
  await db.balanceSnapshot.deleteMany();
  await db.agentProviderBalance.deleteMany();
  await db.agent.deleteMany();
  await db.provider.deleteMany();
  await db.simulationLog.deleteMany();
  seeded = false;
}

export async function seedDatabase() {
  if (await isSeeded()) return { skipped: true };
  await resetDatabase();

  // Providers
  const providerIds: Record<ProviderCode, string> = {} as never;
  for (const p of Object.values(PROVIDERS)) {
    const rec = await db.provider.create({
      data: { code: p.code, name: p.name, brandColor: p.brandColor, softColor: p.softColor, tagline: p.tagline },
    });
    providerIds[p.code] = rec.id;
  }

  // Agents + balances + initial snapshot history (last 60 min, 5-min steps)
  for (const a of DHAKA_AGENTS) {
    const agent = await db.agent.create({
      data: {
        code: a.code,
        name: a.name,
        ownerName: a.owner,
        area: a.area,
        thana: a.thana,
        district: a.district,
        lat: a.lat,
        lng: a.lng,
        status: "active",
        cashBalance: rand(180000, 520000),
        cashCapacity: 800000,
      },
    });

    for (const code of Object.keys(PROVIDERS) as ProviderCode[]) {
      const capacity = 500000;
      const balance = rand(120000, 460000);
      await db.agentProviderBalance.create({
        data: {
          agentId: agent.id,
          providerId: providerIds[code],
          balance,
          capacity,
          latencyMs: randInt(200, 1400),
          isStale: false,
          lastSyncAt: new Date(),
          confidence: 0.92,
        },
      });
    }

    // 60-min history for cash + each provider (5-min steps)
    for (let m = 60; m >= 0; m -= 5) {
      const ts = nowMinus(m);
      await db.balanceSnapshot.create({
        data: { agentId: agent.id, scope: "cash", balance: agent.cashBalance * rand(0.9, 1.1), timestamp: ts },
      });
      for (const code of Object.keys(PROVIDERS) as ProviderCode[]) {
        await db.balanceSnapshot.create({
          data: {
            agentId: agent.id,
            scope: code,
            balance: rand(120000, 460000),
            timestamp: ts,
          },
        });
      }
    }

    // Initial transaction population (last 90 min)
    const txnCount = randInt(20, 40);
    for (let i = 0; i < txnCount; i++) {
      const code = pick(Object.keys(PROVIDERS) as ProviderCode[]);
      const type = pick(TXN_TYPES);
      const amount = pick([500, 1000, 1500, 2000, 2500, 3000, 5000]);
      await db.transaction.create({
        data: {
          agentId: agent.id,
          providerId: providerIds[code],
          type,
          amount,
          customerId: cusId(),
          status: Math.random() < 0.94 ? "success" : "failed",
          timestamp: nowMinus(randInt(0, 90)),
        },
      });
    }
  }

  // Inject the four demo scenarios so the platform shows meaningful state on
  // first load. Each scenario also gets a coordination case + audit trail.
  await injectScenarioA();
  await injectScenarioB();
  await injectScenarioC();
  await injectScenarioD();
  // Inject cross-provider customer relationships for the network graph view.
  await injectCrossProviderCustomers();

  await db.simulationLog.create({ data: { scenario: "reset", detail: "Full synthetic re-seed completed." } });
  seeded = true;
  return { skipped: false };
}

// Inject a handful of customers who transact across multiple providers and
// sometimes across multiple agents. This makes the relationship graph view
// meaningful. All IDs are synthetic.
async function injectCrossProviderCustomers() {
  const agents = await db.agent.findMany({ take: 3 });
  const providers = await db.provider.findMany();
  if (agents.length < 2 || providers.length < 3) return;

  // 8 cross-provider customers, some with anomaly flags
  const crossCustomers = [
    { id: "CUS-XPA1", providers: ["bkash", "nagad"], agents: [agents[0], agents[1]], count: 5, anomaly: false },
    { id: "CUS-XPA2", providers: ["bkash", "rocket"], agents: [agents[0]], count: 4, anomaly: false },
    { id: "CUS-XPA3", providers: ["nagad", "rocket"], agents: [agents[1], agents[2]], count: 6, anomaly: true },
    { id: "CUS-XPA4", providers: ["bkash", "nagad", "rocket"], agents: [agents[0], agents[1]], count: 8, anomaly: false },
    { id: "CUS-XPA5", providers: ["bkash", "nagad"], agents: [agents[2]], count: 3, anomaly: false },
    { id: "CUS-XPA6", providers: ["bkash", "rocket"], agents: [agents[0], agents[2]], count: 5, anomaly: true },
    { id: "CUS-XPA7", providers: ["nagad", "rocket"], agents: [agents[1]], count: 4, anomaly: false },
    { id: "CUS-XPA8", providers: ["bkash", "nagad", "rocket"], agents: [agents[0]], count: 7, anomaly: false },
  ];

  for (const cc of crossCustomers) {
    for (const provCode of cc.providers) {
      const prov = providers.find((p) => p.code === provCode);
      if (!prov) continue;
      for (let i = 0; i < cc.count; i++) {
        const agent = cc.agents[i % cc.agents.length];
        await db.transaction.create({
          data: {
            agentId: agent.id,
            providerId: prov.id,
            type: Math.random() < 0.5 ? "cashin" : "cashout",
            amount: pick([1000, 2000, 3000, 5000]),
            customerId: cc.id,
            status: "success",
            isAnomaly: cc.anomaly && i === 0,
            anomalyTags: cc.anomaly && i === 0 ? "repeated_amount,cross_provider" : null,
            timestamp: nowMinus(randInt(5, 90)),
          },
        });
      }
    }
  }
}

// Scenario A — Hidden provider shortage.
// Karwan Bazar agent: aggregate looks fine, but Nagad e-money is about to run
// out in ~1.5h. Cash + other providers are healthy.
async function injectScenarioA() {
  const agent = await db.agent.findFirst({ where: { code: "AG-KAR-001" } });
  if (!agent) return;
  const nagad = await db.provider.findUnique({ where: { code: "nagad" } });
  const bkash = await db.provider.findUnique({ where: { code: "bkash" } });
  if (!nagad || !bkash) return;

  // Drive Nagad balance down with a clear drain trend.
  await db.agentProviderBalance.update({
    where: { agentId_providerId: { agentId: agent.id, providerId: nagad.id } },
    data: { balance: 42000, capacity: 500000, confidence: 0.84, latencyMs: 900, lastSyncAt: new Date() },
  });
  // recent drain snapshots
  for (let m = 30; m >= 0; m -= 5) {
    await db.balanceSnapshot.create({
      data: { agentId: agent.id, scope: "nagad", balance: 42000 + (30 - m) * 9500, timestamp: nowMinus(m) },
    });
  }
  // a burst of cash-out txns on Nagad
  for (let i = 0; i < 8; i++) {
    await db.transaction.create({
      data: {
        agentId: agent.id,
        providerId: nagad.id,
        type: "cashout",
        amount: pick([2000, 2500, 3000, 4000]),
        customerId: cusId(),
        status: "success",
        timestamp: nowMinus(randInt(0, 30)),
      },
    });
  }

  const alert = await db.alert.create({
    data: {
      agentId: agent.id,
      providerId: nagad.id,
      type: "liquidity",
      category: "shortage",
      severity: "high",
      title: "Nagad e-money shortage likely within ~1.5h",
      message:
        "Aggregate position looks healthy, but Nagad e-money at this outlet is draining fast and may fall below the 20% threshold within ~1.5 hours. Recommend arranging authorised support.",
      messageBn:
        "সতর্কতা: আগামী কয়েক ঘণ্টায় একটি প্রভাইডারের ই-মানি ব্যালেন্স কমে যেতে পারে। অনুগ্রহ করে পরিস্থিতি পর্যালোচনা করুন এবং প্রভাইডার অনুমোদিত চ্যানেলের মাধ্যমে সমন্বয় করুন।",
      evidence: JSON.stringify({
        facts: [
          { label: "Current Nagad balance", value: "42,000 BDT" },
          { label: "Capacity", value: "500,000 BDT" },
          { label: "Threshold (20%)", value: "100,000 BDT" },
          { label: "Projected shortage", value: "~1.5 hours" },
          { label: "Burn rate", value: "~38,000 BDT/hour" },
          { label: "Other providers", value: "Healthy (aggregate OK)" },
        ],
        note: "Hidden provider shortage — aggregate hides per-provider pressure.",
        possibleNormalReasons: [
          "Legitimate Eid/festival cash-out surge on Nagad",
          "Nearby ATM outage pushing Nagad customers to this outlet",
          "Payday salary withdrawal cluster",
        ],
        uncertainty:
          "Forecast confidence is high but burn rate may ease if demand normalises. This is not a final decision — human should confirm before arranging support.",
        safeNextStep:
          "Field officer should confirm the demand pattern and arrange authorised provider support. Do not move funds across providers or wallets.",
        falsePositiveNote:
          "Shortage forecasts may over-state urgency during transient demand spikes. Always cross-check with the outlet.",
      }),
      confidence: 0.84,
      confidenceLabel: "high",
      status: "open",
      scenarioTag: "A",
    },
  });
  await createCaseFor(alert.id, agent.id, nagad.id, "p1", "ops_field");
}

// Scenario B — Liquidity pressure with unusual activity.
// Mirpur agent: physical cash falling quickly + Rocket shows repeated
// near-identical amounts from a small customer group (requires review).
async function injectScenarioB() {
  const agent = await db.agent.findFirst({ where: { code: "AG-MIR-004" } });
  if (!agent) return;
  const rocket = await db.provider.findUnique({ where: { code: "rocket" } });
  if (!rocket) return;

  // cash draining
  await db.agent.update({ where: { id: agent.id }, data: { cashBalance: 95000, status: "degraded" } });
  for (let m = 30; m >= 0; m -= 5) {
    await db.balanceSnapshot.create({
      data: { agentId: agent.id, scope: "cash", balance: 95000 + (30 - m) * 12000, timestamp: nowMinus(m) },
    });
  }

  // repeated near-identical Rocket txns from 2 customers (the suspicious-ish
  // pattern that must be human-reviewed, NOT declared fraud)
  const group = [cusId(), cusId()];
  for (let i = 0; i < 6; i++) {
    await db.transaction.create({
      data: {
        agentId: agent.id,
        providerId: rocket.id,
        type: "cashout",
        amount: 4900,
        customerId: group[i % 2],
        status: "success",
        isAnomaly: true,
        anomalyTags: "repeated_amount,concentrated_customers",
        timestamp: nowMinus(randInt(0, 40)),
      },
    });
  }

  const alert = await db.alert.create({
    data: {
      agentId: agent.id,
      providerId: rocket.id,
      type: "anomaly",
      category: "repeated_amount",
      severity: "high",
      title: "Repeated ~4,900 BDT cash-outs from 2 customers — requires review",
      message:
        "6 near-identical 4,900 BDT Rocket cash-outs from only 2 customers in ~40 min. This could be normal Eid/festival demand or may need review. Do NOT assume fraud.",
      messageBn:
        "একটি প্রভাইডারে বারবার একই পরিমাণের লেনদেন দেখা যাচ্ছে। এটি স্বাভাবিক চাহিদাও হতে পারে, বা পর্যালোচনা প্রয়োজন হতে পারে। অনুগ্রহ করে পরিমাণ যাচাই করে সিদ্ধান্ত নিন।",
      evidence: JSON.stringify({
        facts: [
          { label: "Repeated amount (≈)", value: "4,900 BDT" },
          { label: "Occurrences", value: "6" },
          { label: "Distinct customers", value: "2" },
          { label: "Window", value: "~40 minutes" },
          { label: "Total value", value: "29,400 BDT" },
        ],
        possibleNormalReasons: [
          "Festival salary disbursement in fixed tranches",
          "Merchant batch settlement",
          "Single-employer payday cash-outs",
        ],
        uncertainty: "Concentrated in 2 customers — needs human review before any action.",
        safeNextStep: "Field officer verifies outlet context & customer intent. No blocking or accusation.",
        falsePositiveNote: "High false-positive risk on salary/Eid days. Advisory only.",
      }),
      confidence: 0.72,
      confidenceLabel: "medium",
      status: "open",
      scenarioTag: "B",
    },
  });
  await createCaseFor(alert.id, agent.id, rocket.id, "p1", "risk");
}

// Scenario C — Cross-provider / data inconsistency.
// Dhanmondi agent: bKash feed is delayed & possibly conflicting; confidence
// reduced, no confident recommendation given.
async function injectScenarioC() {
  const agent = await db.agent.findFirst({ where: { code: "AG-DHM-003" } });
  if (!agent) return;
  const bkash = await db.provider.findUnique({ where: { code: "bkash" } });
  if (!bkash) return;

  await db.agentProviderBalance.update({
    where: { agentId_providerId: { agentId: agent.id, providerId: bkash.id } },
    data: { latencyMs: 92000, isStale: true, lastSyncAt: nowMinus(7), confidence: 0.42 },
  });

  const alert = await db.alert.create({
    data: {
      agentId: agent.id,
      providerId: bkash.id,
      type: "data_quality",
      category: "data_conflict",
      severity: "warning",
      title: "bKash feed delayed / possibly conflicting",
      message:
        "bKash feed for this outlet is delayed (~92s) and marked stale (last sync 7 min ago). Confidence reduced. We are not recommending action on a single provider figure.",
      messageBn:
        "একটি প্রভাইডারের ফিড বিলম্বিত বা অসঙ্গতিপূর্ণ। আস্থা কমানো হয়েছে; তাজা ডেটা না আসা পর্যন্ত অপেক্ষা করুন বা এজেন্টের সাথে যাচাই করুন।",
      evidence: JSON.stringify({
        facts: [
          { label: "Feed latency", value: "92.0 s" },
          { label: "Last sync age", value: "~7 min ago" },
          { label: "Marked stale", value: "Yes" },
          { label: "Confidence", value: "0.42 (low)" },
        ],
        possibleNormalReasons: ["Gateway network disruption", "Provider maintenance", "Peak-load back-pressure"],
        uncertainty: "Balance may not reflect reality. Recommendations dampened.",
        safeNextStep: "Wait for re-sync or cross-check with the agent. Do not act on a single figure.",
        falsePositiveNote: "Data-quality flags are intentionally conservative.",
      }),
      confidence: 0.42,
      confidenceLabel: "low",
      status: "open",
      scenarioTag: "C",
    },
  });
  await createCaseFor(alert.id, agent.id, bkash.id, "p2", "ops_field");
}

// Scenario D — Coordinated response and closure (a fully-resolved case with
// a complete audit trail, to show the coordination workflow end-to-end).
async function injectScenarioD() {
  const agent = await db.agent.findFirst({ where: { code: "AG-GUL-002" } });
  if (!agent) return;
  const nagad = await db.provider.findUnique({ where: { code: "nagad" } });
  if (!nagad) return;

  const alert = await db.alert.create({
    data: {
      agentId: agent.id,
      providerId: nagad.id,
      type: "liquidity",
      category: "shortage",
      severity: "critical",
      title: "Nagad e-money critically low — coordinated support arranged",
      message:
        "Nagad e-money fell below the 20% threshold. Alert routed to Field Ops, acknowledged, escalated to Area Manager, and resolved via authorised provider refill channel.",
      messageBn:
        "একটি প্রভাইডারের ই-মানি স্বল্পতা শনাক্ত হয়েছে। সতর্কবার্তা ফিল্ড অপ্স-এ পাঠানো হয়েছে, স্বীকার করা হয়েছে, এবং অনুমোদিত চ্যানেলের মাধ্যমে সমাধান করা হয়েছে।",
      evidence: JSON.stringify({
        facts: [
          { label: "Current Nagad balance", value: "68,000 BDT" },
          { label: "Threshold (20%)", value: "100,000 BDT" },
          { label: "Coordinated via", value: "Authorised provider refill channel" },
          { label: "Case owner", value: "Nadia Rahman (Area Manager)" },
          { label: "Resolution", value: "Balance restored to 320,000 BDT" },
        ],
        possibleNormalReasons: [
          "Genuine festival demand that exceeded normal capacity",
          "Local event drove concentrated Nagad cash-outs",
        ],
        uncertainty:
          "Case is resolved. The shortage was real but managed through the authorised channel — no cross-provider transfer occurred.",
        safeNextStep:
          "Monitor the outlet for the next 2 hours to confirm the refill holds. No further action unless pressure returns.",
        falsePositiveNote:
          "Resolved cases remain in the audit trail for traceability. They do not indicate ongoing risk.",
      }),
      confidence: 0.9,
      confidenceLabel: "high",
      status: "resolved",
      scenarioTag: "D",
    },
  });

  const caseRec = await db.case.create({
    data: {
      alertId: alert.id,
      agentId: agent.id,
      providerId: nagad.id,
      priority: "p1",
      ownerRole: "ops_area",
      ownerName: "Nadia Rahman",
      status: "resolved",
      escalationPath: JSON.stringify(["ops_field", "ops_area"]),
      resolvedAt: nowMinus(8),
    },
  });
  const ev: [string, string, string, string][] = [
    ["created", "System", "system", "Critical liquidity alert auto-routed to Field Ops."],
    ["acknowledged", "Tanvir Ahmed", "ops_field", "Acknowledged. Contacting outlet to confirm."],
    ["assigned", "Tanvir Ahmed", "ops_field", "Outlet confirms heavy Nagad cash-out demand."],
    ["escalated", "Tanvir Ahmed", "ops_field", "Escalated to Area Manager for authorised support."],
    ["note", "Nadia Rahman", "ops_area", "Approved authorised refill through provider channel. No cross-provider transfer."],
    ["resolved", "Nadia Rahman", "ops_area", "Nagad balance restored to 320,000 BDT. Case closed."],
  ];
  for (const [type, actor, role, note] of ev) {
    await db.caseEvent.create({
      data: { caseId: caseRec.id, type, actor, role, note, createdAt: nowMinus(randInt(2, 60)) },
    });
  }
  // Reflect the resolved balance.
  await db.agentProviderBalance.update({
    where: { agentId_providerId: { agentId: agent.id, providerId: nagad.id } },
    data: { balance: 320000, confidence: 0.9, isStale: false, latencyMs: 600, lastSyncAt: new Date() },
  });
}

async function createCaseFor(
  alertId: string,
  agentId: string,
  providerId: string | null,
  priority: string,
  ownerRole: string
) {
  const c = await db.case.create({
    data: {
      alertId,
      agentId,
      providerId,
      priority,
      ownerRole,
      ownerName: null,
      status: "open",
      escalationPath: JSON.stringify(["ops_field", "ops_area", "risk"]),
    },
  });
  await db.caseEvent.create({
    data: {
      caseId: c.id,
      type: "created",
      actor: "System",
      role: "system",
      note: "Alert auto-routed. Awaiting acknowledgement.",
      createdAt: new Date(),
    },
  });
  await db.alert.update({ where: { id: alertId }, data: { status: "open" } });
}

// --- Live simulation tick --------------------------------------------------
// Adds a few fresh transactions + updates balances + pushes snapshots so the
// dashboard feels live. Also randomly toggles a feed stale to keep data-quality
// signals realistic. Returns a summary the websocket can broadcast.
export async function simulationTick() {
  const agents = await db.agent.findMany();
  const providers = await db.provider.findMany();
  let newTxns = 0;
  for (const a of agents) {
    const n = randInt(0, 3);
    for (let i = 0; i < n; i++) {
      const p = pick(providers);
      const type = pick(TXN_TYPES);
      const amount = pick([500, 1000, 1500, 2000, 2500, 3000, 5000]);
      await db.transaction.create({
        data: {
          agentId: a.id,
          providerId: p.id,
          type,
          amount,
          customerId: cusId(),
          status: Math.random() < 0.95 ? "success" : "failed",
          timestamp: new Date(),
        },
      });
      newTxns++;
      // adjust balances
      const bal = await db.agentProviderBalance.findUnique({
        where: { agentId_providerId: { agentId: a.id, providerId: p.id } },
      });
      if (bal) {
        const delta = CASH_TYPES.has(type) ? amount : -amount;
        const next = Math.max(0, Math.min(bal.capacity, bal.balance + delta));
        await db.agentProviderBalance.update({
          where: { id: bal.id },
          data: { balance: next, lastSyncAt: new Date(), latencyMs: randInt(200, 1500) },
        });
        await db.balanceSnapshot.create({
          data: { agentId: a.id, scope: p.code, balance: next, timestamp: new Date() },
        });
      }
      if (CASH_TYPES.has(type)) {
        await db.agent.update({ where: { id: a.id }, data: { cashBalance: { increment: amount } } });
      } else {
        await db.agent.update({ where: { id: a.id }, data: { cashBalance: { decrement: amount } } });
      }
      const cashNow = await db.agent.findUnique({ where: { id: a.id } });
      if (cashNow) {
        await db.balanceSnapshot.create({
          data: { agentId: a.id, scope: "cash", balance: cashNow.cashBalance, timestamp: new Date() },
        });
      }
    }
    // small chance to mark a feed stale or fresh
    if (Math.random() < 0.18) {
      const p = pick(providers);
      const bal = await db.agentProviderBalance.findUnique({
        where: { agentId_providerId: { agentId: a.id, providerId: p.id } },
      });
      if (bal) {
        const stale = Math.random() < 0.5;
        await db.agentProviderBalance.update({
          where: { id: bal.id },
          data: {
            isStale: stale,
            latencyMs: stale ? randInt(60000, 120000) : randInt(200, 1500),
            lastSyncAt: stale ? nowMinus(randInt(1, 8)) : new Date(),
            confidence: stale ? 0.45 : 0.9,
          },
        });
      }
    }
  }
  await db.simulationLog.create({ data: { scenario: "tick", detail: `Live tick: ${newTxns} new txns.` } });
  return { newTxns, agents: agents.length };
}
