import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeForecast } from "@/lib/forecast";

// POST /api/whatif  { agentId, providerCode, demandMultiplier, hours }
// Projects what happens to a provider's e-money (or cash) if cash-out demand
// increases by `demandMultiplier` (e.g. 2.0 = double demand) for `hours` hours.
// This is a SAFE decision-support tool — it only forecasts, never executes.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { agentId, providerCode, demandMultiplier = 1.5, hours = 4 } = body as {
    agentId?: string;
    providerCode?: string;
    demandMultiplier?: number;
    hours?: number;
  };

  if (!agentId || !providerCode) {
    return NextResponse.json({ error: "agentId and providerCode required" }, { status: 400 });
  }
  const mult = Math.max(0.1, Math.min(5, Number(demandMultiplier) || 1.5));
  const hrs = Math.max(1, Math.min(48, Number(hours) || 4));

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

  let current: number, capacity: number, confidence: number, isStale: boolean;
  let scope: string, label: string;

  if (providerCode === "cash") {
    current = agent.cashBalance;
    capacity = agent.cashCapacity;
    confidence = 0.95;
    isStale = false;
    scope = "cash";
    label = "Physical Cash (shared)";
  } else {
    const provider = await db.provider.findUnique({ where: { code: providerCode } });
    if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });
    const bal = await db.agentProviderBalance.findUnique({
      where: { agentId_providerId: { agentId, providerId: provider.id } },
    });
    if (!bal) return NextResponse.json({ error: "balance not found" }, { status: 404 });
    current = bal.balance;
    capacity = bal.capacity;
    confidence = bal.confidence;
    isStale = bal.isStale;
    scope = providerCode;
    label = `${provider.name} e-Money`;
  }

  // Baseline forecast (current burn rate)
  const baseline = await computeForecast({ agentId, scope, current, capacity, confidence, isStale });
  const baseBurn = baseline.burnRatePerHour;

  // Shocked burn = baseline burn × demand multiplier (only the drain component)
  // If baseline is building (negative burn), the shock increases drain toward 0.
  const shockedBurn = baseBurn > 0 ? baseBurn * mult : Math.abs(baseBurn) * (mult - 1);

  // Project the balance curve hour-by-hour
  const threshold = capacity * 0.2;
  const series: { hour: number; baseline: number; shocked: number }[] = [];
  let balBase = current;
  let balShock = current;
  let shortageHour: number | null = null;
  for (let h = 0; h <= hrs; h++) {
    series.push({ hour: h, baseline: Math.max(0, Math.round(balBase)), shocked: Math.max(0, Math.round(balShock)) });
    if (shortageHour === null && balShock <= threshold) shortageHour = h;
    balBase = Math.max(0, balBase - baseBurn);
    balShock = Math.max(0, balShock - shockedBurn);
  }

  const finalShocked = Math.max(0, Math.round(current - shockedBurn * hrs));
  const wouldShortage = shortageHour !== null;

  return NextResponse.json({
    agent: { id: agent.id, code: agent.code, name: agent.name, area: agent.area },
    scope,
    label,
    current: Math.round(current),
    capacity,
    threshold: Math.round(threshold),
    demandMultiplier: mult,
    hours: hrs,
    baseBurnPerHour: Math.round(baseBurn),
    shockedBurnPerHour: Math.round(shockedBurn),
    projectedFinal: finalShocked,
    shortageHour,
    wouldShortage,
    safeNote: wouldShortage
      ? `At ${mult}× demand, ${label} may fall below the 20% threshold in ~${shortageHour}h. Recommend arranging authorised provider support before then. No automatic action.`
      : `At ${mult}× demand for ${hrs}h, ${label} stays above the 20% threshold. Continue monitoring.`,
    series,
  });
}
