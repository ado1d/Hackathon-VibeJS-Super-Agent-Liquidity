import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agents — list all agents (for the agent selector).
export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { code: "asc" },
    include: { providerBalances: { include: { provider: true } } },
  });
  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      ownerName: a.ownerName,
      area: a.area,
      thana: a.thana,
      district: a.district,
      status: a.status,
      cashBalance: a.cashBalance,
      cashCapacity: a.cashCapacity,
      lat: a.lat,
      lng: a.lng,
      providerBalances: a.providerBalances.map((pb) => ({
        code: pb.provider.code,
        name: pb.provider.name,
        balance: pb.balance,
        capacity: pb.capacity,
        isStale: pb.isStale,
        confidence: pb.confidence,
      })),
    })),
  });
}
