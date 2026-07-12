import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/alerts/[id]  { status, actor, role, note, agentCode }
// Update alert status with role-permission + status-transition validation.
const ROLE_PERMS: Record<string, { canAcknowledge: boolean; canEscalate: boolean; canResolve: boolean }> = {
  agent: { canAcknowledge: true, canEscalate: true, canResolve: false },
  ops_field: { canAcknowledge: true, canEscalate: true, canResolve: true },
  ops_area: { canAcknowledge: true, canEscalate: true, canResolve: true },
  risk: { canAcknowledge: true, canEscalate: true, canResolve: false },
  management: { canAcknowledge: false, canEscalate: false, canResolve: false },
};

// Valid alert status transitions
const VALID_ALERT_TRANSITIONS: Record<string, string[]> = {
  open: ["acknowledged"],
  acknowledged: ["owned", "escalated", "resolved"],
  owned: ["escalated", "resolved"],
  escalated: ["resolved"],
  resolved: ["open"], // reopened
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  const role = body.role ?? "ops_field";
  const agentCode = body.agentCode;

  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const alert = await db.alert.findUnique({ where: { id }, include: { agent: true } });
  if (!alert) return NextResponse.json({ error: "alert not found" }, { status: 404 });

  // 1. Role permission check
  const perms = ROLE_PERMS[role] ?? ROLE_PERMS.ops_field;
  if (status === "acknowledged" && !perms.canAcknowledge) {
    return NextResponse.json({ error: `${role} role cannot acknowledge.` }, { status: 403 });
  }
  if (status === "escalated" && !perms.canEscalate) {
    return NextResponse.json({ error: `${role} role cannot escalate.` }, { status: 403 });
  }
  if (status === "resolved" && !perms.canResolve) {
    return NextResponse.json({ error: `${role} role cannot resolve.` }, { status: 403 });
  }

  // 2. Status transition check
  const validNext = VALID_ALERT_TRANSITIONS[alert.status] ?? [];
  if (!validNext.includes(status)) {
    return NextResponse.json({
      error: `Cannot transition from ${alert.status} to ${status}. Valid transitions: ${validNext.join(", ") || "none"}.`,
      currentStatus: alert.status,
      attemptedStatus: status,
    }, { status: 403 });
  }

  // 3. Agent ownership check
  if (role === "agent" && agentCode && alert.agent.code !== agentCode) {
    return NextResponse.json({ error: "Agent can only act on alerts for their own outlet." }, { status: 403 });
  }

  await db.alert.update({ where: { id }, data: { status } });
  const existingCase = await db.case.findUnique({ where: { alertId: id } });
  if (existingCase) {
    const caseStatus =
      status === "resolved" ? "resolved"
      : status === "escalated" ? "escalated"
      : status === "owned" ? "assigned"
      : status === "acknowledged" ? "acknowledged"
      : status === "open" ? "open" // reopened
      : existingCase.status;
    await db.case.update({
      where: { id: existingCase.id },
      data: {
        status: caseStatus,
        resolvedAt: status === "resolved" ? new Date() : existingCase.resolvedAt,
      },
    });
    await db.caseEvent.create({
      data: {
        caseId: existingCase.id,
        type: status === "acknowledged" ? "acknowledged" : status === "owned" ? "assigned" : status === "escalated" ? "escalated" : status === "resolved" ? "resolved" : status === "open" ? "reopened" : "note",
        actor: body.actor ?? "Operator",
        role: role,
        note: body.note ?? `Alert status updated to ${status}.`,
        createdAt: new Date(),
      },
    });
  }
  return NextResponse.json({ ok: true, alert });
}
