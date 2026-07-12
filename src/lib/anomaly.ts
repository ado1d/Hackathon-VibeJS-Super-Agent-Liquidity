import { db } from "./db";
import type { AnomalyEvidence } from "./types";

// Lightweight, explainable anomaly detectors.
// IMPORTANT: These surface "unusual activity that requires review" — they NEVER
// declare fraud. Every detector returns human-readable evidence + uncertainty +
// a safe next step, plus a documented false-positive note.

export interface DetectedAnomaly {
  agentId: string;
  providerId: string | null;
  category: string; // velocity | repeated_amount | cash_drain | data_conflict
  severity: "critical" | "high" | "warning" | "info";
  title: string;
  message: string;
  evidence: AnomalyEvidence;
  sampleTxIds: string[];
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
}

function confLabel(c: number): "low" | "medium" | "high" {
  if (c >= 0.8) return "high";
  if (c >= 0.55) return "medium";
  return "low";
}

// --- Detector 1: repeated / near-identical amounts from a small group of
//     accounts (Scenario B). ----------------------------------------------
export async function detectRepeatedAmounts(
  agentId: string,
  providerId: string,
  windowMinutes = 45
): Promise<DetectedAnomaly | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const txs = await db.transaction.findMany({
    where: { agentId, providerId, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
  });
  if (txs.length < 5) return null;

  // round amounts to nearest 100 to catch "near-identical" values
  const buckets = new Map<number, typeof txs>();
  for (const t of txs) {
    const key = Math.round(t.amount / 100) * 100;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }
  let best: { amount: number; txs: typeof txs } | null = null;
  for (const [amount, group] of buckets) {
    // Require >=5 occurrences to reduce false positives on salary/Eid days.
    if (group.length >= 5 && (!best || group.length > best.txs.length)) {
      best = { amount, txs: group };
    }
  }
  if (!best) return null;

  const uniqueCustomers = new Set(best.txs.map((t) => t.customerId)).size;
  const totalValue = best.txs.reduce((s, t) => s + t.amount, 0);
  // Confidence rises with repetition and concentration, but we cap it: this
  // pattern is common on Eid / salary days and must be human-reviewed.
  const rawConf = Math.min(
    0.78,
    0.45 + best.txs.length * 0.05 + (uniqueCustomers <= 3 ? 0.12 : 0)
  );
  const confidence = Number(rawConf.toFixed(2));

  const evidence: AnomalyEvidence = {
    summary: `${best.txs.length} near-identical ${Math.round(
      best.amount
    )} BDT transactions from ${uniqueCustomers} customer${
      uniqueCustomers === 1 ? "" : "s"
    } within ${windowMinutes} min.`,
    facts: [
      { label: "Repeated amount (≈)", value: `${Math.round(best.amount)} BDT` },
      { label: "Occurrences", value: String(best.txs.length) },
      { label: "Distinct customers", value: String(uniqueCustomers) },
      { label: "Window", value: `${windowMinutes} minutes` },
      { label: "Total value", value: `${totalValue.toLocaleString()} BDT` },
    ],
    sampleTx: best.txs.slice(0, 4).map((t) => ({
      id: t.id.slice(-6).toUpperCase(),
      amount: t.amount,
      customer: t.customerId,
      time: new Date(t.timestamp).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    possibleNormalReasons: [
      "Legitimate Eid / festival salary disbursement in fixed tranches",
      "Merchant batch settlement for a nearby vendor",
      "Cash-out cluster from a single employer's payday",
    ],
    uncertainty:
      uniqueCustomers <= 2
        ? "Concentrated in very few customers — needs human review before any action."
        : "Could be a normal demand cluster — context (day, event) is needed.",
    safeNextStep:
      "Field officer should verify the outlet context and customer intent. Do NOT block or accuse.",
    falsePositiveNote:
      "Expected false-positive risk is HIGH on salary/Eid days. This flag is advisory only.",
  };

  return {
    agentId,
    providerId,
    category: "repeated_amount",
    severity: uniqueCustomers <= 2 ? "high" : "warning",
    title: "Repeated near-identical amounts — requires review",
    message: `${best.txs.length} transactions of ≈${Math.round(
      best.amount
    )} BDT from ${uniqueCustomers} customer(s) in ${windowMinutes} min. Could be normal demand; needs review.`,
    evidence,
    sampleTxIds: best.txs.map((t) => t.id),
    confidence,
    confidenceLabel: confLabel(confidence),
  };
}

// --- Detector 2: transaction velocity spike (Scenario B secondary) --------
export async function detectVelocitySpike(
  agentId: string,
  providerId: string,
  windowMinutes = 30
): Promise<DetectedAnomaly | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const sincePrev = new Date(since.getTime() - windowMinutes * 60 * 1000);
  const [recent, prev] = await Promise.all([
    db.transaction.count({ where: { agentId, providerId, timestamp: { gte: since } } }),
    db.transaction.count({
      where: { agentId, providerId, timestamp: { gte: sincePrev, lt: since } },
    }),
  ]);
  if (recent < 10) return null;
  const ratio = prev > 0 ? recent / prev : recent / 4;
  if (ratio < 3.0) return null;

  const confidence = Number(Math.min(0.72, 0.4 + ratio * 0.06).toFixed(2));
  const evidence: AnomalyEvidence = {
    summary: `Transaction velocity is ${ratio.toFixed(
      1
    )}× the previous ${windowMinutes}-min window.`,
    facts: [
      { label: "Recent window", value: `${recent} txns / ${windowMinutes} min` },
      { label: "Previous window", value: `${prev} txns / ${windowMinutes} min` },
      { label: "Velocity ratio", value: `${ratio.toFixed(1)}×` },
    ],
    sampleTx: [],
    possibleNormalReasons: [
      "Festival / payday demand spike",
      "Nearby ATM outage pushing customers to the agent",
      "Local market closing-time rush",
    ],
    uncertainty:
      "Velocity alone is not suspicious. Pair with amount-pattern and context before review.",
    safeNextStep:
      "Confirm with the outlet whether a local event explains the spike. No automatic action.",
    falsePositiveNote:
      "Velocity spikes are expected during peak hours and festivals. Advisory only.",
  };

  return {
    agentId,
    providerId,
    category: "velocity",
    severity: "warning",
    title: "Transaction velocity spike — confirm context",
    message: `${recent} transactions in ${windowMinutes} min (${ratio.toFixed(
      1
    )}× previous window). Likely demand; confirm context.`,
    evidence,
    sampleTxIds: [],
    confidence,
    confidenceLabel: confLabel(confidence),
  };
}

// --- Detector 3: data-quality conflict (Scenario C) -----------------------
// Detects stale / delayed provider feeds and marks confidence down.
export async function detectDataConflict(
  agentId: string,
  providerId: string
): Promise<DetectedAnomaly | null> {
  const bal = await db.agentProviderBalance.findUnique({
    where: { agentId_providerId: { agentId, providerId } },
  });
  if (!bal) return null;
  // Only flag when the feed is genuinely stale: both marked stale AND latency
  // over 60s, OR last sync older than 4 minutes. This cuts conservative
  // false positives from brief latency blips.
  const ageSec = Math.round((Date.now() - bal.lastSyncAt.getTime()) / 1000);
  const genuinelyStale = bal.isStale && bal.latencyMs > 60000;
  const agedSync = ageSec > 240;
  if (!genuinelyStale && !agedSync) return null;

  const confidence = Number(Math.max(0.3, 0.85 - bal.latencyMs / 200000).toFixed(2));
  const evidence: AnomalyEvidence = {
    summary: `Provider feed for ${
      bal.providerId ? "" : ""
    }this agent is delayed or possibly conflicting.`,
    facts: [
      { label: "Feed latency", value: `${(bal.latencyMs / 1000).toFixed(1)} s` },
      { label: "Last sync age", value: `${ageSec} s ago` },
      { label: "Marked stale", value: bal.isStale ? "Yes" : "No" },
    ],
    sampleTx: [],
    possibleNormalReasons: [
      "Temporary network disruption at the provider gateway",
      "Scheduled provider maintenance window",
      "Sync back-pressure during peak load",
    ],
    uncertainty:
      "Balance figure may not reflect reality. Recommendations are dampened until fresh data arrives.",
    safeNextStep:
      "Do not act on a single provider figure. Wait for re-sync or cross-check with the agent before recommending support.",
    falsePositiveNote:
      "Data-quality flags are intentionally conservative — better to dampen than to mislead.",
  };

  return {
    agentId,
    providerId,
    category: "data_conflict",
    severity: "warning",
    title: "Provider feed delayed / possibly conflicting",
    message: `Feed latency ${(bal.latencyMs / 1000).toFixed(
      1
    )}s, last sync ${ageSec}s ago. Confidence reduced; avoid confident recommendations.`,
    evidence,
    sampleTxIds: [],
    confidence,
    confidenceLabel: confLabel(confidence),
  };
}

// Suppression window: if an alert of the same category+agent+provider was
// resolved within the last N minutes, do NOT re-fire. This prevents the same
// pattern from immediately re-surfacing after a human reviews it.
const SUPPRESSION_MINUTES = 15;

async function isSuppressed(
  agentId: string,
  providerId: string | null,
  category: string
): Promise<boolean> {
  const since = new Date(Date.now() - SUPPRESSION_MINUTES * 60 * 1000);
  const recent = await db.alert.findFirst({
    where: {
      agentId,
      providerId: providerId ?? undefined,
      category,
      status: "resolved",
      updatedAt: { gte: since },
    },
  });
  return !!recent;
}

// Run all detectors across all agent/provider pairs and return new findings.
export async function runAnomalyScan(): Promise<DetectedAnomaly[]> {
  const agents = await db.agent.findMany();
  const providers = await db.provider.findMany();
  const findings: DetectedAnomaly[] = [];
  for (const a of agents) {
    for (const p of providers) {
      const [rep, vel, data] = await Promise.all([
        detectRepeatedAmounts(a.id, p.id),
        detectVelocitySpike(a.id, p.id),
        detectDataConflict(a.id, p.id),
      ]);
      // Apply suppression: skip patterns a human just reviewed & resolved.
      if (rep && !(await isSuppressed(a.id, p.id, "repeated_amount"))) findings.push(rep);
      if (vel && !(await isSuppressed(a.id, p.id, "velocity"))) findings.push(vel);
      if (data && !(await isSuppressed(a.id, p.id, "data_conflict"))) findings.push(data);
    }
  }
  return findings;
}
