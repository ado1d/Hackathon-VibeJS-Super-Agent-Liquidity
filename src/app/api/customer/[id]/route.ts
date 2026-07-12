import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/customer/[id] — full transaction history for a synthetic customer
// across all providers and agents. Privacy-preserving: only simulated IDs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = decodeURIComponent(id);

  const txns = await db.transaction.findMany({
    where: { customerId },
    include: { agent: true, provider: true },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  if (txns.length === 0) {
    return NextResponse.json({ error: "no transactions for this customer", customerId }, { status: 404 });
  }

  const providers = new Map<string, { code: string; name: string; brandColor: string; count: number; value: number }>();
  const agents = new Map<string, { code: string; name: string; area: string; count: number }>();
  let totalValue = 0;
  let anomalyCount = 0;
  const typeCount: Record<string, number> = {};

  for (const t of txns) {
    if (t.status !== "success") continue;
    totalValue += t.amount;
    if (t.isAnomaly) anomalyCount++;
    typeCount[t.type] = (typeCount[t.type] ?? 0) + 1;

    const pKey = t.provider.code;
    const p = providers.get(pKey) ?? { code: t.provider.code, name: t.provider.name, brandColor: t.provider.brandColor, count: 0, value: 0 };
    p.count++;
    p.value += t.amount;
    providers.set(pKey, p);

    const aKey = t.agent.code;
    const a = agents.get(aKey) ?? { code: t.agent.code, name: t.agent.name, area: t.agent.area, count: 0 };
    a.count++;
    agents.set(aKey, a);
  }

  return NextResponse.json({
    customerId,
    totalTransactions: txns.length,
    successfulTransactions: txns.filter((t) => t.status === "success").length,
    failedTransactions: txns.filter((t) => t.status === "failed").length,
    totalValue,
    anomalyCount,
    typeCount,
    providers: Array.from(providers.values()).sort((a, b) => b.count - a.count),
    agents: Array.from(agents.values()).sort((a, b) => b.count - a.count),
    transactions: txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      isAnomaly: t.isAnomaly,
      anomalyTags: t.anomalyTags,
      timestamp: t.timestamp,
      provider: { code: t.provider.code, name: t.provider.name, brandColor: t.provider.brandColor },
      agent: { code: t.agent.code, name: t.agent.name, area: t.agent.area },
    })),
    note: "Synthetic identifier only — no real customer identity. Cross-provider activity is a pattern insight, not proof of wrongdoing.",
  });
}
