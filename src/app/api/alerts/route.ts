import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/simulate";

// GET /api/alerts?status=...&severity=...&type=...
// Returns alerts with agent + provider + (optional) case joined.
export async function GET(req: Request) {
  await seedDatabase();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");
  const type = url.searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;

  const alerts = await db.alert.findMany({
    where,
    include: { agent: true, provider: true, case: { include: { events: { orderBy: { createdAt: "asc" } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      category: a.category,
      severity: a.severity,
      title: a.title,
      message: a.message,
      messageBn: a.messageBn,
      evidence: a.evidence,
      confidence: a.confidence,
      confidenceLabel: a.confidenceLabel,
      status: a.status,
      scenarioTag: a.scenarioTag,
      createdAt: a.createdAt,
      agent: { id: a.agent.id, code: a.agent.code, name: a.agent.name, area: a.agent.area },
      provider: a.provider
        ? { code: a.provider.code, name: a.provider.name, brandColor: a.provider.brandColor }
        : null,
      case: a.case
        ? {
            id: a.case.id,
            status: a.case.status,
            priority: a.case.priority,
            ownerRole: a.case.ownerRole,
            ownerName: a.case.ownerName,
            escalationPath: a.case.escalationPath,
            createdAt: a.case.createdAt,
            resolvedAt: a.case.resolvedAt,
            events: a.case.events.map((e) => ({
              id: e.id,
              type: e.type,
              actor: e.actor,
              role: e.role,
              note: e.note,
              createdAt: e.createdAt,
            })),
          }
        : null,
    })),
  });
}
