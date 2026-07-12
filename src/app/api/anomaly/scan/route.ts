import { NextResponse } from "next/server";
import { runAnomalyScan } from "@/lib/anomaly";
import { db } from "@/lib/db";

// POST /api/anomaly/scan — runs the explainable anomaly detectors across all
// agents/providers and persists any NEW findings as alerts + cases.
// Returns the list of newly-created alerts (for the websocket to broadcast).
export async function POST() {
  const findings = await runAnomalyScan();
  const created: { id: string; title: string; agentCode: string; severity: string }[] = [];

  for (const f of findings) {
    // de-dup: skip if an open alert of same category+agent+provider exists
    const dup = await db.alert.findFirst({
      where: {
        agentId: f.agentId,
        providerId: f.providerId,
        category: f.category,
        status: { not: "resolved" },
      },
    });
    if (dup) continue;

    const agent = await db.agent.findUnique({ where: { id: f.agentId } });
    const provider = f.providerId ? await db.provider.findUnique({ where: { id: f.providerId } }) : null;

    const alertType =
      f.category === "data_conflict" ? "data_quality" : "anomaly";

    const alert = await db.alert.create({
      data: {
        agentId: f.agentId,
        providerId: f.providerId,
        type: alertType,
        category: f.category,
        severity: f.severity,
        title: f.title,
        message: f.message,
        messageBn: null,
        evidence: JSON.stringify(f.evidence),
        confidence: f.confidence,
        confidenceLabel: f.confidenceLabel,
        status: "open",
        scenarioTag: null,
      },
    });
    // open a coordination case routed to risk for anomaly, ops for data quality
    const ownerRole = f.category === "data_conflict" ? "ops_field" : "risk";
    const c = await db.case.create({
      data: {
        alertId: alert.id,
        agentId: f.agentId,
        providerId: f.providerId,
        priority: f.severity === "high" || f.severity === "critical" ? "p1" : "p2",
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
        actor: "Anomaly Engine",
        role: "system",
        note: `Detected by ${f.category} detector. Confidence ${f.confidence}. Advisory only — requires human review.`,
        createdAt: new Date(),
      },
    });
    created.push({
      id: alert.id,
      title: f.title,
      agentCode: agent?.code ?? "?",
      severity: f.severity,
    });
  }

  return NextResponse.json({ ok: true, newAlerts: created, scanned: findings.length });
}
