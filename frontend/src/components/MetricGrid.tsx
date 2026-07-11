import { AlertTriangle, Banknote, Clock3, DatabaseZap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Agent, Alert } from "../types";

interface MetricGridProps {
  agents: Agent[];
  alerts: Alert[];
}

function nearestShortage(agents: Agent[]): number | null {
  return agents.reduce<number | null>((min, agent) => {
    if (agent.nearest_shortage_minutes == null) return min;
    return min == null || agent.nearest_shortage_minutes < min
      ? agent.nearest_shortage_minutes
      : min;
  }, null);
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "critical";
}) {
  return (
    <article className={`metric${tone ? ` ${tone}` : ""}`}>
      <Icon />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function MetricGrid({ agents, alerts }: MetricGridProps) {
  const nearest = nearestShortage(agents);
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const openCount = alerts.filter((a) => a.status !== "resolved").length;

  return (
    <section className="metric-grid" aria-label="Summary metrics">
      <Metric
        icon={DatabaseZap}
        label="Agents in scope"
        value={agents.length}
      />
      <Metric
        icon={AlertTriangle}
        label="Critical alerts"
        value={criticalCount}
        tone="critical"
      />
      <Metric icon={Clock3} label="Open cases" value={openCount} />
      <Metric
        icon={Banknote}
        label="Nearest pressure"
        value={nearest == null ? "Stable" : `${Math.round(nearest)}m`}
      />
    </section>
  );
}
