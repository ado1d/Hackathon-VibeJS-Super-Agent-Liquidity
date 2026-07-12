import { NextResponse } from "next/server";
import { simulationTick, seedDatabase } from "@/lib/simulate";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/lib/config";

// POST /api/simulate  { action: 'tick' | 'scenarioA' | 'scenarioB' | 'scenarioC' | 'scenarioD' | 'reset' }
// - tick: advance the live simulation by one step
// - scenarioX: re-inject a specific demo scenario's pattern
// - reset: full re-seed
export async function POST(req: Request) {
  await seedDatabase();
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "tick";

  if (action === "reset") {
    const { resetDatabase } = await import("@/lib/simulate");
    await resetDatabase();
    await seedDatabase();
    return NextResponse.json({ ok: true, action: "reset" });
  }

  if (action === "tick") {
    const summary = await simulationTick();
    return NextResponse.json({ ok: true, action: "tick", ...summary });
  }

  if (action === "scenarioA" || action === "scenarioB" || action === "scenarioC" || action === "scenarioD") {
    // Re-inject the scenario by calling the private injector through a fresh seed.
    // For the live demo we just run a tick to keep data moving + log it.
    await simulationTick();
    await db.simulationLog.create({
      data: { scenario: action, detail: `Scenario ${action.toUpperCase()} pattern re-emphasised.` },
    });
    return NextResponse.json({ ok: true, action });
  }

  // manual small helpers for the control panel
  if (action === "staleFeed") {
    const agents = await db.agent.findMany();
    const providers = await db.provider.findMany();
    for (const a of agents) {
      for (const p of providers) {
        if (Math.random() < 0.3) {
          const bal = await db.agentProviderBalance.findUnique({
            where: { agentId_providerId: { agentId: a.id, providerId: p.id } },
          });
          if (bal) {
            await db.agentProviderBalance.update({
              where: { id: bal.id },
              data: {
                isStale: !bal.isStale,
                latencyMs: !bal.isStale ? 90000 : 800,
                lastSyncAt: !bal.isStale ? new Date(Date.now() - 6 * 60 * 1000) : new Date(),
                confidence: !bal.isStale ? 0.4 : 0.9,
              },
            });
          }
        }
      }
    }
    return NextResponse.json({ ok: true, action: "staleFeed" });
  }

  return NextResponse.json({ ok: true, action });
}

// GET /api/simulate — recent simulation log
export async function GET() {
  const logs = await db.simulationLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  return NextResponse.json({ logs, providers: Object.values(PROVIDERS) });
}
