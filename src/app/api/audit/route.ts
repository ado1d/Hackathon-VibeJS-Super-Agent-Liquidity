import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/audit — global audit trail of all coordination events (traceability).
export async function GET() {
  const events = await db.caseEvent.findMany({
    include: { case: { include: { alert: { include: { agent: true, provider: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      role: e.role,
      note: e.note,
      createdAt: e.createdAt,
      caseId: e.caseId,
      alert: e.case?.alert
        ? {
            id: e.case.alert.id,
            title: e.case.alert.title,
            severity: e.case.alert.severity,
            scenarioTag: e.case.alert.scenarioTag,
            agent: { code: e.case.alert.agent.code, name: e.case.alert.agent.name, area: e.case.alert.agent.area },
            provider: e.case.alert.provider
              ? { code: e.case.alert.provider.code, name: e.case.alert.provider.name }
              : null,
          }
        : null,
    })),
  });
}
