import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/alerts/[id]/ack  { actor, role, agentCode }
// Acknowledge an alert — the first coordination step.
// Validates: role permission, alert must be "open", agent ownership.
const ROLE_PERMS: Record<string, { canAcknowledge: boolean }> = {
  agent: { canAcknowledge: true },
  ops_field: { canAcknowledge: true },
  ops_area: { canAcknowledge: true },
  risk: { canAcknowledge: true },
  management: { canAcknowledge: false },
};

// Note: agent can acknowledge and escalate but NOT resolve.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role ?? "ops_field";
  const agentCode = body.agentCode;

  // Check alert exists and get current status
  const alert = await db.alert.findUnique({ where: { id }, include: { agent: true } });
  if (!alert) return NextResponse.json({ error: "alert not found" }, { status: 404 });

  // 1. Role permission check
  const perms = ROLE_PERMS[role] ?? ROLE_PERMS.ops_field;
  if (!perms.canAcknowledge) {
    return NextResponse.json({ error: `${role} role does not have permission to acknowledge alerts.` }, { status: 403 });
  }

  // 2. Status check — can only acknowledge "open" alerts
  if (alert.status !== "open") {
    return NextResponse.json({
      error: `Cannot acknowledge an alert that is already ${alert.status}.`,
      currentStatus: alert.status,
    }, { status: 403 });
  }

  // 3. Agent ownership check
  if (role === "agent" && agentCode) {
    if (alert.agent.code !== agentCode) {
      return NextResponse.json({
        error: "Agent can only acknowledge alerts for their own outlet.",
      }, { status: 403 });
    }
  }

  await db.alert.update({ where: { id }, data: { status: "acknowledged" } });
  const c = await db.case.findUnique({ where: { alertId: id } });
  if (c) {
    // Update owner to the acknowledger
    await db.case.update({
      where: { id: c.id },
      data: {
        status: "acknowledged",
        ownerRole: role,
        ownerName: body.actor ?? "Operator",
      },
    });
    await db.caseEvent.create({
      data: {
        caseId: c.id,
        type: "acknowledged",
        actor: body.actor ?? "Operator",
        role: role,
        note: body.note ?? "Alert acknowledged by operations.",
        createdAt: new Date(),
      },
    });
  }
  return NextResponse.json({ ok: true });
}
