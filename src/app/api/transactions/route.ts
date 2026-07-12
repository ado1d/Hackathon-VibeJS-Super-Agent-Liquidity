import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/simulate";

// GET /api/transactions?agent=<id>&provider=<code>&anomaly=1&limit=<n>
export async function GET(req: Request) {
  await seedDatabase();
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent");
  const providerCode = url.searchParams.get("provider");
  const onlyAnomaly = url.searchParams.get("anomaly") === "1";
  const limit = Number(url.searchParams.get("limit") ?? 60);

  const agent = agentId
    ? await db.agent.findUnique({ where: { id: agentId } })
    : await db.agent.findFirst({ orderBy: { code: "asc" } });
  if (!agent) return NextResponse.json({ error: "no agent" }, { status: 404 });

  const where: Record<string, unknown> = { agentId: agent.id };
  if (providerCode && providerCode !== "all") {
    const p = await db.provider.findUnique({ where: { code: providerCode } });
    if (p) where.providerId = p.id;
  }
  if (onlyAnomaly) where.isAnomaly = true;

  const txns = await db.transaction.findMany({
    where,
    include: { provider: true },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({
    agent: { id: agent.id, code: agent.code, name: agent.name },
    transactions: txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      customerId: t.customerId,
      status: t.status,
      isAnomaly: t.isAnomaly,
      anomalyTags: t.anomalyTags,
      provider: { code: t.provider.code, name: t.provider.name, brandColor: t.provider.brandColor },
      timestamp: t.timestamp,
    })),
  });
}
