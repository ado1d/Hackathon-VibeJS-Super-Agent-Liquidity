import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/relationships — cross-provider customer network view.
//
// Uses simulated customer identifiers (CUS-XXXX) to discover customers who
// transact across MORE THAN ONE provider at the same agent or across agents.
// This is a privacy-preserving pattern view: we never expose real identities,
// only synthetic IDs and aggregate relationship strength.
//
// This satisfies the hackathon optional advanced objective:
// "Explore cross-provider pattern insight or network relationships using
//  simulated identifiers."

export async function GET() {
  const txns = await db.transaction.findMany({
    where: { status: "success" },
    include: { agent: true, provider: true },
    orderBy: { timestamp: "desc" },
    take: 2000,
  });

  // Group transactions by customerId
  const byCustomer = new Map<string, {
    customerId: string;
    providers: Set<string>;
    agents: Set<string>;
    txns: { id: string; amount: number; type: string; providerCode: string; agentCode: string; timestamp: Date; isAnomaly: boolean }[];
  }>();

  for (const t of txns) {
    const c = byCustomer.get(t.customerId) ?? {
      customerId: t.customerId,
      providers: new Set<string>(),
      agents: new Set<string>(),
      txns: [],
    };
    c.providers.add(t.provider.code);
    c.agents.add(t.agent.code);
    c.txns.push({
      id: t.id,
      amount: t.amount,
      type: t.type,
      providerCode: t.provider.code,
      agentCode: t.agent.code,
      timestamp: t.timestamp,
      isAnomaly: t.isAnomaly,
    });
    byCustomer.set(t.customerId, c);
  }

  // Nodes: providers + cross-provider customers
  const providerNodes = [
    { id: "bkash", label: "bKash", type: "provider", color: "#E2136E" },
    { id: "nagad", label: "Nagad", type: "provider", color: "#EC1C24" },
    { id: "rocket", label: "Rocket", type: "provider", color: "#8B5CF6" },
  ];

  // Only include customers who use >= 2 providers (cross-provider) OR have anomaly flags
  const crossCustomers = Array.from(byCustomer.values())
    .filter((c) => c.providers.size >= 2 || c.txns.some((t) => t.isAnomaly))
    .map((c) => {
      const totalValue = c.txns.reduce((s, t) => s + t.amount, 0);
      const hasAnomaly = c.txns.some((t) => t.isAnomaly);
      return {
        id: c.customerId,
        label: c.customerId,
        type: "customer",
        providerCount: c.providers.size,
        agentCount: c.agents.size,
        txnCount: c.txns.length,
        totalValue,
        hasAnomaly,
        providers: Array.from(c.providers),
        agents: Array.from(c.agents),
      };
    })
    .sort((a, b) => b.providerCount - a.providerCount || b.totalValue - a.totalValue)
    .slice(0, 30); // top 30 for readability

  // Edges: customer ↔ provider (weight = transaction count)
  const edges: { source: string; target: string; weight: number; value: number; isAnomaly: boolean }[] = [];
  for (const cust of crossCustomers) {
    for (const provCode of cust.providers) {
      const custData = byCustomer.get(cust.id)!;
      const provTxns = custData.txns.filter((t) => t.providerCode === provCode);
      edges.push({
        source: cust.id,
        target: provCode,
        weight: provTxns.length,
        value: provTxns.reduce((s, t) => s + t.amount, 0),
        isAnomaly: provTxns.some((t) => t.isAnomaly),
      });
    }
  }

  // Summary stats
  const totalCustomers = byCustomer.size;
  const crossProviderCustomers = Array.from(byCustomer.values()).filter((c) => c.providers.size >= 2).length;
  const multiAgentCustomers = Array.from(byCustomer.values()).filter((c) => c.agents.size >= 2).length;
  const anomalyCustomers = Array.from(byCustomer.values()).filter((c) => c.txns.some((t) => t.isAnomaly)).length;

  return NextResponse.json({
    nodes: [...providerNodes, ...crossCustomers.map((c) => ({ id: c.id, label: c.label, type: c.type, ...c }))],
    edges,
    customers: crossCustomers,
    summary: {
      totalCustomers,
      crossProviderCustomers,
      multiAgentCustomers,
      anomalyCustomers,
      crossProviderPct: totalCustomers > 0 ? crossProviderCustomers / totalCustomers : 0,
    },
  });
}
