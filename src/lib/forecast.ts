import { db } from "./db";
import type { LiquidityForecast } from "./types";

// Liquidity forecasting engine.
// Uses recent net outflow rate (burn rate) to project when a balance (cash or
// a provider e-money) may run low. Confidence is reduced when the underlying
// feed is stale or the history is short — this implements the "safe fallback"
// requirement (Scenario A & C).

const SHORTAGE_THRESHOLD_PCT = 0.2; // "running low" = below 20% of capacity
const LOOKBACK_MINUTES = 60;

export interface ForecastInput {
  agentId: string;
  scope: string; // 'cash' | provider code
  current: number;
  capacity: number;
  confidence: number;
  isStale: boolean;
}

export async function computeForecast(
  input: ForecastInput
): Promise<LiquidityForecast> {
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const snaps = await db.balanceSnapshot.findMany({
    where: { agentId: input.agentId, scope: input.scope, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
  });

  // Build a smooth series: real snapshots + current point.
  const series = snaps.map((s) => ({ t: s.timestamp.toISOString(), balance: s.balance }));
  series.push({ t: new Date().toISOString(), balance: input.current });

  // Burn rate: net change per hour over the lookback window.
  let burnRatePerHour = 0;
  if (snaps.length >= 2) {
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const hours =
      (last.timestamp.getTime() - first.timestamp.getTime()) / 3_600_000 || 1;
    burnRatePerHour = (first.balance - last.balance) / hours; // positive => draining
  }

  // If draining, project when we cross the shortage threshold.
  let hoursToShortage: number | null = null;
  let projectedShortageAt: string | null = null;
  const threshold = input.capacity * SHORTAGE_THRESHOLD_PCT;
  if (burnRatePerHour > 0) {
    const hours = (input.current - threshold) / burnRatePerHour;
    if (hours > 0 && hours < 72) {
      hoursToShortage = Number(hours.toFixed(1));
      projectedShortageAt = new Date(
        Date.now() + hours * 3_600_000
      ).toISOString();
    }
  }

  // Confidence adjustment: stale feeds or short history => lower confidence.
  let conf = input.confidence;
  if (input.isStale) conf = Math.min(conf, 0.45);
  if (snaps.length < 3) conf = Math.min(conf, 0.55);
  conf = Number(conf.toFixed(2));

  const label =
    input.scope === "cash"
      ? "Physical Cash (shared)"
      : input.scope.charAt(0).toUpperCase() + input.scope.slice(1) + " e-Money";

  return {
    scope: input.scope,
    label,
    current: input.current,
    capacity: input.capacity,
    burnRatePerHour: Number(burnRatePerHour.toFixed(0)),
    hoursToShortage,
    projectedShortageAt,
    confidence: conf,
    confidenceLabel: conf >= 0.8 ? "high" : conf >= 0.55 ? "medium" : "low",
    series,
  };
}

// Detect a liquidity shortage alert condition from a forecast.
export function shortageFromForecast(
  f: LiquidityForecast,
  agentId: string,
  providerId: string | null
) {
  const threshold = f.capacity * SHORTAGE_THRESHOLD_PCT;
  const isShortage =
    f.current <= threshold ||
    (f.hoursToShortage !== null && f.hoursToShortage <= 3);
  if (!isShortage) return null;

  const severity =
    f.current <= threshold
      ? "critical"
      : f.hoursToShortage !== null && f.hoursToShortage <= 1.5
      ? "high"
      : "warning";

  return {
    agentId,
    providerId,
    category: "shortage",
    severity,
    confidence: f.confidence,
    confidenceLabel: f.confidenceLabel,
    hoursToShortage: f.hoursToShortage,
    threshold,
  };
}
