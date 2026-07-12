import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/simulate";
import { computeForecast } from "@/lib/forecast";
import { PROVIDERS } from "@/lib/config";
import type { BalanceView, LiquidityForecast, ProviderCode } from "@/lib/types";

// GET /api/balances?agent=<id>  (defaults to first agent)
// Returns: the unified liquidity view (shared cash + 3 provider e-money),
// per-scope forecasts, and aggregate position. This is the core "unified view"
// the hackathon mandates — cash + separate provider balances, never merged.
export async function GET(req: Request) {
  await seedDatabase();
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent");

  const agent = agentId
    ? await db.agent.findUnique({ where: { id: agentId } })
    : await db.agent.findFirst({ orderBy: { code: "asc" } });
  if (!agent) return NextResponse.json({ error: "no agent" }, { status: 404 });

  const providerBalances = await db.agentProviderBalance.findMany({
    where: { agentId: agent.id },
    include: { provider: true },
  });

  const views: BalanceView[] = [];
  const forecasts: LiquidityForecast[] = [];

  // Shared physical cash
  views.push({
    provider: "cash",
    label: "Physical Cash (shared)",
    balance: agent.cashBalance,
    capacity: agent.cashCapacity,
    pct: agent.cashBalance / agent.cashCapacity,
    confidence: 0.95,
  });
  forecasts.push(
    await computeForecast({
      agentId: agent.id,
      scope: "cash",
      current: agent.cashBalance,
      capacity: agent.cashCapacity,
      confidence: 0.95,
      isStale: false,
    })
  );

  // Per-provider e-money
  for (const code of Object.keys(PROVIDERS) as ProviderCode[]) {
    const pb = providerBalances.find((b) => b.provider.code === code);
    if (!pb) continue;
    views.push({
      provider: code,
      label: `${PROVIDERS[code].name} e-Money`,
      balance: pb.balance,
      capacity: pb.capacity,
      pct: pb.balance / pb.capacity,
      isStale: pb.isStale,
      latencyMs: pb.latencyMs,
      confidence: pb.confidence,
    });
    forecasts.push(
      await computeForecast({
        agentId: agent.id,
        scope: code,
        current: pb.balance,
        capacity: pb.capacity,
        confidence: pb.confidence,
        isStale: pb.isStale,
      })
    );
  }

  const totalEmoney = providerBalances.reduce((s, b) => s + b.balance, 0);
  const aggregatePct =
    (agent.cashBalance + totalEmoney) /
    (agent.cashCapacity + providerBalances.reduce((s, b) => s + b.capacity, 0));

  return NextResponse.json({
    agent: {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      ownerName: agent.ownerName,
      area: agent.area,
      thana: agent.thana,
      district: agent.district,
      status: agent.status,
    },
    views,
    forecasts,
    aggregate: {
      totalCash: agent.cashBalance,
      totalEmoney,
      totalValue: agent.cashBalance + totalEmoney,
      pct: aggregatePct,
    },
  });
}
