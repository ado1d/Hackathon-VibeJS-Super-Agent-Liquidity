import type { AlertStatus, Role } from "../types";

interface WorkflowActionBarProps {
  status: AlertStatus;
  ownerUserId: string | null;
  role: Role | undefined;
  onAction: (name: string, body?: unknown) => void;
  disabled?: boolean;
}

const CAN_COORDINATE: Role[] = ["operations", "risk", "admin"];

export function WorkflowActionBar({
  status,
  ownerUserId,
  role,
  onAction,
  disabled,
}: WorkflowActionBarProps) {
  const canCoordinate = role != null && CAN_COORDINATE.includes(role);
  if (!canCoordinate) return null;

  const buttons: {
    label: string;
    action: string;
    body?: unknown;
    show: boolean;
  }[] = [
    {
      label: "Claim",
      action: "claim",
      show: !ownerUserId,
    },
    {
      label: "Acknowledge",
      action: "acknowledge",
      show: ["new", "reopened"].includes(status),
    },
    {
      label: "Start progress",
      action: "in-progress",
      show: ["new", "acknowledged", "reopened", "escalated"].includes(status),
    },
    {
      label: "Escalate",
      action: "escalate",
      body: {
        assigned_role: "risk",
        note: "Escalated for evidence-led review.",
      },
      show: ["new", "acknowledged", "in_progress", "reopened"].includes(status),
    },
    {
      label: "Resolve",
      action: "resolve",
      body: {
        resolution_code: "reviewed_no_further_action",
        note: "Synthetic evidence reviewed; no further prototype action required.",
      },
      show: ["acknowledged", "in_progress", "escalated", "reopened"].includes(
        status,
      ),
    },
    {
      label: "Reopen",
      action: "reopen",
      show: status === "resolved",
    },
  ];

  return (
    <div className="action-bar">
      {buttons
        .filter((b) => b.show)
        .map((b) => (
          <button
            key={b.action}
            onClick={() => onAction(b.action, b.body)}
            disabled={disabled}
          >
            {b.label}
          </button>
        ))}
    </div>
  );
}
