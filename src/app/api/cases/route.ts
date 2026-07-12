import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/cases — list coordination cases with audit trail.
export async function GET() {
  const cases = await db.case.findMany({
    include: {
      alert: { include: { agent: true, provider: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      ownerRole: c.ownerRole,
      ownerName: c.ownerName,
      escalationPath: c.escalationPath,
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt,
      alert: {
        id: c.alert.id,
        title: c.alert.title,
        type: c.alert.type,
        severity: c.alert.severity,
        category: c.alert.category,
        message: c.alert.message,
        messageBn: c.alert.messageBn,
        evidence: c.alert.evidence,
        confidence: c.alert.confidence,
        confidenceLabel: c.alert.confidenceLabel,
        scenarioTag: c.alert.scenarioTag,
        agent: { code: c.alert.agent.code, name: c.alert.agent.name, area: c.alert.agent.area },
        provider: c.alert.provider
          ? { code: c.alert.provider.code, name: c.alert.provider.name, brandColor: c.alert.provider.brandColor }
          : null,
      },
      events: c.events.map((e) => ({
        id: e.id,
        type: e.type,
        actor: e.actor,
        role: e.role,
        note: e.note,
        createdAt: e.createdAt,
      })),
    })),
  });
}

// POST /api/cases  { alertId, ownerRole, ownerName, priority, note }
// Assign / re-assign a case owner.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { alertId, ownerRole, ownerName, priority, note, actor, role } = body as {
    alertId: string;
    ownerRole: string;
    ownerName?: string;
    priority?: string;
    note?: string;
    actor?: string;
    role?: string;
  };
  if (!alertId || !ownerRole) {
    return NextResponse.json({ error: "alertId and ownerRole required" }, { status: 400 });
  }
  const existing = await db.case.findUnique({ where: { alertId } });
  if (!existing) return NextResponse.json({ error: "case not found" }, { status: 404 });

  const updated = await db.case.update({
    where: { id: existing.id },
    data: {
      ownerRole,
      ownerName: ownerName ?? existing.ownerName,
      priority: priority ?? existing.priority,
      status: "assigned",
    },
  });
  await db.alert.update({ where: { id: alertId }, data: { status: "owned" } });
  await db.caseEvent.create({
    data: {
      caseId: existing.id,
      type: "assigned",
      actor: actor ?? "Operator",
      role: role ?? ownerRole,
      note: note ?? `Case assigned to ${ownerName ?? ownerRole}.`,
      createdAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true, case: updated });
}
