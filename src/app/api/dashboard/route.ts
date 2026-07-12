import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/simulate";
import type { DashboardKpi } from "@/lib/types";

// GET /api/dashboard — aggregated KPIs for the command center.
export async function GET() {
  await seedDatabase();
  const [agents, alerts, cases, balances, cashAgg] = await Promise.all([
    db.agent.findMany(),
    db.alert.findMany(),
    db.case.findMany(),
    db.agentProviderBalance.findMany(),
    db.agent.aggregate({ _sum: { cashBalance: true } }),
  ]);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const degradedAgents = agents.filter((a) => a.status !== "active").length;
  const openAlerts = alerts.filter((a) => a.status !== "resolved").length;
  const criticalAlerts = alerts.filter(
    (a) => a.status !== "resolved" && (a.severity === "critical" || a.severity === "high")
  ).length;
  const totalEmoney = balances.reduce((s, b) => s + b.balance, 0);
  const totalCash = cashAgg._sum.cashBalance ?? 0;
  const openCases = cases.filter((c) => c.status !== "resolved").length;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const resolvedToday = cases.filter(
    (c) => c.status === "resolved" && c.resolvedAt && c.resolvedAt >= startOfDay
  ).length;

  const avgConfidence =
    balances.length > 0
      ? balances.reduce((s, b) => s + b.confidence, 0) / balances.length
      : 0;

  const kpi: DashboardKpi = {
    activeAgents,
    degradedAgents,
    openAlerts,
    criticalAlerts,
    totalCash,
    totalEmoney,
    avgConfidence: Number(avgConfidence.toFixed(2)),
    openCases,
    resolvedToday,
  };

  return NextResponse.json(kpi);
}
