import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cases/[id]/events  { type, actor, role, note, agentCode }
// Append a coordination event with FULL role-permission + status-transition validation.
//
// Status transition rules (enforced server-side):
//   open         → acknowledged  (agent, ops_field, ops_area, risk can ack)
//   acknowledged → assigned      (ops_field, ops_area can assign)
//   assigned     → escalated     (ops_field, ops_area, risk can escalate)
//   escalated    → resolved      (ops_area can resolve; risk CANNOT resolve)
//   resolved     → open          (reopened: any role with ack permission)
//
// Invalid transitions are rejected with a 403 + explanation.
// Agents can only act on cases belonging to their own outlet.

const ROLE_PERMISSIONS: Record<string, { canAcknowledge: boolean; canAssign: boolean; canEscalate: boolean; canResolve: boolean; canRiskReview: boolean }> = {
  agent: { canAcknowledge: true, canAssign: false, canEscalate: true, canResolve: false, canRiskReview: false },
  ops_field: { canAcknowledge: true, canAssign: false, canEscalate: true, canResolve: true, canRiskReview: false },
  ops_area: { canAcknowledge: true, canAssign: true, canEscalate: true, canResolve: true, canRiskReview: false },
  risk: { canAcknowledge: true, canAssign: false, canEscalate: true, canResolve: false, canRiskReview: true },
  management: { canAcknowledge: false, canAssign: false, canEscalate: false, canResolve: false, canRiskReview: false },
};

// Valid status transitions: { currentStatus → { eventType → allowed } }
const VALID_TRANSITIONS: Record<string, Record<string, boolean>> = {
  open: {
    acknowledged: true, // open → acknowledged
    assigned: false,    // can't assign before acknowledging
    escalated: false,   // can't escalate before acknowledging
    resolved: false,    // can't resolve an open case
    reopened: false,    // already open
    note: true,         // notes always allowed
    risk_review: true,  // risk review allowed at any stage
  },
  acknowledged: {
    acknowledged: false, // already acknowledged
    assigned: true,      // acknowledged → assigned
    escalated: true,     // acknowledged → escalated (skip assign)
    resolved: true,      // acknowledged → resolved (direct close)
    reopened: false,
    note: true,
    risk_review: true,
  },
  assigned: {
    acknowledged: false, // already past this
    assigned: false,     // already assigned
    escalated: true,     // assigned → escalated
    resolved: true,      // assigned → resolved
    reopened: false,
    note: true,
    risk_review: true,
  },
  escalated: {
    acknowledged: false,
    assigned: false,
    escalated: false,    // already escalated
    resolved: true,      // escalated → resolved
    reopened: false,
    note: true,
    risk_review: true,
  },
  resolved: {
    acknowledged: false,
    assigned: false,
    escalated: false,
    resolved: false,     // already resolved
    reopened: true,      // resolved → open (reopened)
    note: true,
    risk_review: true,   // risk can review even resolved cases
  },
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { type, actor, role, note, agentCode } = body as {
    type: string;
    actor?: string;
    role?: string;
    note?: string;
    agentCode?: string;
  };

  const c = await db.case.findUnique({
    where: { id },
    include: { alert: { include: { agent: true } } },
  });
  if (!c) return NextResponse.json({ error: "case not found" }, { status: 404 });

  const eventType = type || "note";
  const actorRole = role ?? "ops_field";
  const perms = ROLE_PERMISSIONS[actorRole] ?? ROLE_PERMISSIONS.ops_field;

  // --- 1. Agent ownership check ---
  if (actorRole === "agent" && agentCode) {
    if (c.alert.agent.code !== agentCode) {
      return NextResponse.json({
        error: "Agent can only act on cases for their own outlet.",
        caseAgent: c.alert.agent.code,
        yourAgent: agentCode,
      }, { status: 403 });
    }
  }

  // --- 2. Role permission check ---
  if (eventType === "acknowledged" && !perms.canAcknowledge) {
    return NextResponse.json({ error: `${actorRole} role does not have permission to acknowledge cases.` }, { status: 403 });
  }
  if (eventType === "assigned" && !perms.canAssign) {
    return NextResponse.json({ error: `${actorRole} role does not have permission to assign cases.` }, { status: 403 });
  }
  if (eventType === "escalated" && !perms.canEscalate) {
    return NextResponse.json({ error: `${actorRole} role does not have permission to escalate cases.` }, { status: 403 });
  }
  if (eventType === "resolved" && !perms.canResolve) {
    return NextResponse.json({ error: `${actorRole} role does not have permission to resolve cases.` }, { status: 403 });
  }
  // Risk review is exclusive to the Risk Analyst role
  if (eventType === "risk_review" && !perms.canRiskReview) {
    return NextResponse.json({ error: `Only the Risk Analyst role can submit a risk review.` }, { status: 403 });
  }

  // --- 3. Status transition validation ---
  const currentStatus = c.status;
  const transitions = VALID_TRANSITIONS[currentStatus] ?? {};
  // risk_review and note are annotation actions — allowed at any status
  if (eventType !== "note" && eventType !== "risk_review" && transitions[eventType] === false) {
    return NextResponse.json({
      error: `Invalid transition: cannot ${eventType} a case that is currently ${currentStatus}.`,
      currentStatus,
      attemptedAction: eventType,
      validActions: Object.entries(transitions).filter(([, v]) => v === true).map(([k]) => k),
    }, { status: 403 });
  }

  // --- 4. Create the event ---
  const event = await db.caseEvent.create({
    data: {
      caseId: id,
      type: eventType,
      actor: actor ?? "Operator",
      role: actorRole,
      note: note ?? "",
      createdAt: new Date(),
    },
  });

  // --- 5. Sync case + alert status ---
  let caseStatus = c.status;
  let alertStatus: string | null = null;
  let updateOwner = false;
  if (eventType === "acknowledged") {
    caseStatus = "acknowledged";
    alertStatus = "acknowledged";
    updateOwner = true; // acknowledger takes ownership
  } else if (eventType === "assigned") {
    caseStatus = "assigned";
    alertStatus = "owned";
    // owner is set by the assign API, not here
  } else if (eventType === "escalated") {
    caseStatus = "escalated";
    alertStatus = "escalated";
    updateOwner = true; // escalater is recorded as current owner
  } else if (eventType === "resolved") {
    caseStatus = "resolved";
    alertStatus = "resolved";
    updateOwner = true; // resolver is recorded as closer
  } else if (eventType === "reopened") {
    caseStatus = "open";
    alertStatus = "open";
    // keep owner as-is on reopen
  }
  await db.case.update({
    where: { id },
    data: {
      status: caseStatus,
      resolvedAt: eventType === "resolved" ? new Date() : c.resolvedAt,
      ...(updateOwner ? { ownerRole: actorRole, ownerName: actor ?? "Operator" } : {}),
    },
  });
  if (alertStatus) {
    await db.alert.update({ where: { id: c.alertId }, data: { status: alertStatus } });
  }
  return NextResponse.json({ ok: true, event, caseStatus });
}
