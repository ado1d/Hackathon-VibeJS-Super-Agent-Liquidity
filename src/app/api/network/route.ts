import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/network — area-wise & agent-level network intelligence.
// Returns:
//  - agents with geo coords, liquidity %, pressure score, alert count, stale count
//  - area aggregations (hotspots) ranked by combined pressure
//  - nearby-agent suggestions for each agent (haversine distance, sorted asc)
//
// All data is SYNTHETIC. This supports the hackathon optional advanced
// objectives: "area-wise prioritization" and "nearby-agent support discovery".

const R_EARTH = 6371; // km

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

export async function GET() {
  const agents = await db.agent.findMany({
    include: { providerBalances: { include: { provider: true } } },
  });
  const alerts = await db.alert.findMany({ where: { status: { not: "resolved" } } });

  const agentNodes = agents.map((a) => {
    const cashPct = a.cashBalance / a.cashCapacity;
    const provBalances = a.providerBalances.map((pb) => ({
      code: pb.provider.code,
      name: pb.provider.name,
      brandColor: pb.provider.brandColor,
      balance: pb.balance,
      capacity: pb.capacity,
      pct: pb.balance / pb.capacity,
      isStale: pb.isStale,
      confidence: pb.confidence,
    }));
    const lowProviders = provBalances.filter((p) => p.pct < 0.2).length;
    const staleProviders = provBalances.filter((p) => p.isStale).length;
    const agentAlerts = alerts.filter((al) => al.agentId === a.id);
    const criticalAlerts = agentAlerts.filter(
      (al) => al.severity === "critical" || al.severity === "high"
    ).length;
    const avgProvPct =
      provBalances.reduce((s, p) => s + p.pct, 0) / (provBalances.length || 1);

    // Pressure score 0..100 (higher = worse).
    // Components: low cash, low provider balance, stale feeds, alert volume.
    const cashPenalty = Math.max(0, 0.2 - cashPct) * 150; // up to 30
    const provPenalty = lowProviders * 18; // up to ~54
    const stalePenalty = staleProviders * 8; // up to 24
    const alertPenalty = Math.min(30, criticalAlerts * 15 + agentAlerts.length * 2);
    const pressureScore = Math.round(
      Math.min(100, cashPenalty + provPenalty + stalePenalty + alertPenalty)
    );

    const healthLabel =
      pressureScore >= 60 ? "critical" : pressureScore >= 35 ? "pressured" : pressureScore >= 15 ? "watch" : "healthy";

    return {
      id: a.id,
      code: a.code,
      name: a.name,
      ownerName: a.ownerName,
      area: a.area,
      thana: a.thana,
      district: a.district,
      lat: a.lat,
      lng: a.lng,
      status: a.status,
      cashBalance: a.cashBalance,
      cashCapacity: a.cashCapacity,
      cashPct,
      providerBalances: provBalances,
      avgProvPct,
      lowProviders,
      staleProviders,
      alertCount: agentAlerts.length,
      criticalAlerts,
      pressureScore,
      healthLabel,
    };
  });

  // Nearby-agent suggestions (within 8 km, sorted by distance).
  const NEARBY_KM = 8;
  const nearby: Record<string, { code: string; name: string; area: string; distanceKm: number; pressureScore: number; healthLabel: string; cashPct: number }[]> = {};
  for (const a of agentNodes) {
    const list = agentNodes
      .filter((b) => b.id !== a.id)
      .map((b) => ({
        code: b.code,
        name: b.name,
        area: b.area,
        distanceKm: Number(haversineKm(a.lat, a.lng, b.lat, b.lng).toFixed(2)),
        pressureScore: b.pressureScore,
        healthLabel: b.healthLabel,
        cashPct: b.cashPct,
      }))
      .filter((b) => b.distanceKm <= NEARBY_KM)
      .sort((x, y) => x.distanceKm - y.distanceKm);
    nearby[a.code] = list;
  }

  // Area aggregations (hotspots).
  const areaMap = new Map<string, {
    area: string;
    agentCount: number;
    totalCash: number;
    totalCashCap: number;
    totalEmoney: number;
    totalEmoneyCap: number;
    alertCount: number;
    criticalAlerts: number;
    lowProviders: number;
    staleProviders: number;
    pressureSum: number;
    agents: { code: string; name: string; pressureScore: number; healthLabel: string }[];
  }>();

  for (const a of agentNodes) {
    const key = a.area;
    const cur = areaMap.get(key) ?? {
      area: key,
      agentCount: 0,
      totalCash: 0,
      totalCashCap: 0,
      totalEmoney: 0,
      totalEmoneyCap: 0,
      alertCount: 0,
      criticalAlerts: 0,
      lowProviders: 0,
      staleProviders: 0,
      pressureSum: 0,
      agents: [],
    };
    cur.agentCount++;
    cur.totalCash += a.cashBalance;
    cur.totalCashCap += a.cashCapacity;
    cur.totalEmoney += a.providerBalances.reduce((s, p) => s + p.balance, 0);
    cur.totalEmoneyCap += a.providerBalances.reduce((s, p) => s + p.capacity, 0);
    cur.alertCount += a.alertCount;
    cur.criticalAlerts += a.criticalAlerts;
    cur.lowProviders += a.lowProviders;
    cur.staleProviders += a.staleProviders;
    cur.pressureSum += a.pressureScore;
    cur.agents.push({ code: a.code, name: a.name, pressureScore: a.pressureScore, healthLabel: a.healthLabel });
    areaMap.set(key, cur);
  }

  const hotspots = Array.from(areaMap.values())
    .map((ar) => ({
      ...ar,
      avgPressure: Math.round(ar.pressureSum / ar.agentCount),
      cashPct: ar.totalCash / (ar.totalCashCap || 1),
      emoneyPct: ar.totalEmoney / (ar.totalEmoneyCap || 1),
      healthLabel: ar.pressureSum / ar.agentCount >= 60 ? "critical" : ar.pressureSum / ar.agentCount >= 35 ? "pressured" : ar.pressureSum / ar.agentCount >= 15 ? "watch" : "healthy",
    }))
    .sort((a, b) => b.avgPressure - a.avgPressure);

  return NextResponse.json({
    agents: agentNodes,
    nearby,
    hotspots,
    summary: {
      totalAgents: agentNodes.length,
      healthy: agentNodes.filter((a) => a.healthLabel === "healthy").length,
      watch: agentNodes.filter((a) => a.healthLabel === "watch").length,
      pressured: agentNodes.filter((a) => a.healthLabel === "pressured").length,
      critical: agentNodes.filter((a) => a.healthLabel === "critical").length,
      avgPressure: Math.round(agentNodes.reduce((s, a) => s + a.pressureScore, 0) / (agentNodes.length || 1)),
    },
  });
}
