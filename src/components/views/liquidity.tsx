"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend as RLegend,
} from "recharts";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtPct, fmtHours, providerClasses } from "@/lib/format";
import { PROVIDERS } from "@/lib/config";
import { SectionTitle, ConfidenceBadge, ProgressBar, Pill, Sparkline } from "@/components/app/primitives";
import { Waves, Banknote, Smartphone, AlertTriangle, Timer, TrendingDown, DatabaseZap } from "lucide-react";

interface Props {
  balances: any;
}

const SCOPE_COLORS: Record<string, string> = {
  cash: "#34d399",
  bkash: "#E2136E",
  nagad: "#EC1C24",
  rocket: "#8B5CF6",
};

export function LiquidityView({ balances }: Props) {
  const chartData = useMemo(() => {
    if (!balances?.forecasts) return [];
    const map = new Map<string, any>();
    for (const f of balances.forecasts) {
      for (const p of f.series) {
        const k = p.t;
        const row = map.get(k) ?? { t: k, time: new Date(k).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
        row[f.scope] = Math.round(p.balance);
        map.set(k, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => +new Date(a.t) - +new Date(b.t));
  }, [balances]);

  if (!balances) return null;
  const { agent, views, forecasts, aggregate } = balances;

  const shortages = forecasts.filter((f: any) => f.hoursToShortage !== null);
  const maxCap = Math.max(...forecasts.map((f: any) => f.capacity));

  return (
    <div className="space-y-5 fade-up">
      {/* Agent header */}
      <div className="surface rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary/15 text-primary">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{agent.name}</span>
              <span className="text-xs text-muted-foreground tnum">{agent.code}</span>
              <Pill className={cn(agent.status === "active" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : "border-amber-500/30 text-amber-300 bg-amber-500/10")}>
                {agent.status}
              </Pill>
            </div>
            <div className="text-xs text-muted-foreground">{agent.ownerName} · {agent.area}, {agent.thana}, {agent.district}</div>
          </div>
        </div>
        <div className="md:ml-auto grid grid-cols-3 gap-4">
          <Stat label="Total Value" value={fmtBDT(aggregate.totalValue)} unit="BDT" />
          <Stat label="Shared Cash" value={fmtBDT(aggregate.totalCash)} unit="BDT" />
          <Stat label="E-Money" value={fmtBDT(aggregate.totalEmoney)} unit="BDT" />
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {views.map((v: any) => {
          const isCash = v.provider === "cash";
          const cls = isCash ? providerClasses("cash") : providerClasses(v.provider);
          const Icon = isCash ? Banknote : Smartphone;
          const forecast = forecasts.find((f: any) => f.scope === v.provider);
          return (
            <div key={v.provider} className={cn("surface rounded-xl p-4", isCash ? "border-emerald-500/20" : cls.border)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", cls.text)} />
                  <span className="text-sm font-medium">{v.label}</span>
                </div>
                {v.isStale && (
                  <Pill className="border-amber-500/30 text-amber-300 bg-amber-500/10">
                    <DatabaseZap className="w-2.5 h-2.5" /> stale
                  </Pill>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className={cn("text-2xl font-bold tnum", cls.text)}>{fmtBDT(v.balance)}</span>
                <span className="text-xs text-muted-foreground">/ {fmtBDT(v.capacity)}</span>
              </div>
              <ProgressBar pct={v.pct} tone={isCash ? "emerald" : v.provider === "bkash" ? "pink" : v.provider === "nagad" ? "orange" : "violet"} />
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{fmtPct(v.pct)} of capacity</span>
                <ConfidenceBadge label={v.confidence >= 0.8 ? "high" : v.confidence >= 0.55 ? "medium" : "low"} />
              </div>
              {/* Sparkline trend from forecast series */}
              {forecast?.series && forecast.series.length > 2 && (
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">60-min trend</div>
                  <Sparkline
                    data={forecast.series.map((p: any) => p.balance)}
                    color={isCash ? "#34d399" : v.provider === "bkash" ? "#E2136E" : v.provider === "nagad" ? "#EC1C24" : "#8B5CF6"}
                    width={110}
                    height={26}
                  />
                </div>
              )}
              {forecast?.burnRatePerHour ? (
                <div className={cn("mt-2 text-[11px] flex items-center gap-1", forecast.burnRatePerHour > 0 ? "text-rose-300" : "text-emerald-300")}>
                  <TrendingDown className="w-3 h-3" />
                  {forecast.burnRatePerHour > 0 ? `${fmtBDT(forecast.burnRatePerHour)}/h drain` : `${fmtBDT(-forecast.burnRatePerHour)}/h build`}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Shortage predictions */}
      {shortages.length > 0 && (
        <div className="surface rounded-xl p-4">
          <SectionTitle
            title="Projected Shortages"
            desc="Forward-looking liquidity pressure — confidence reflects data quality & history depth."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shortages.map((f: any) => {
              const cls = f.scope === "cash" ? providerClasses("cash") : providerClasses(f.scope);
              const sev = f.hoursToShortage! <= 1 ? "rose" : f.hoursToShortage! <= 3 ? "amber" : "default";
              return (
                <div key={f.scope} className={cn("rounded-lg border p-3.5", sev === "rose" ? "border-rose-500/30 bg-rose-500/5" : sev === "amber" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card/40")}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={cn("w-4 h-4", sev === "rose" ? "text-rose-300" : "text-amber-300")} />
                    <span className="font-medium text-sm">{f.label}</span>
                    <span className={cn("ml-auto text-[10px] px-1.5 py-0.5 rounded border font-medium", severityFor(f.hoursToShortage!))}>
                      {f.hoursToShortage! <= 1 ? "critical" : f.hoursToShortage! <= 3 ? "high" : "warning"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xl font-bold tnum">{fmtHours(f.hoursToShortage)}</span>
                    <span className="text-xs text-muted-foreground">to reach 20% threshold</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    Burn {fmtBDT(f.burnRatePerHour)} BDT/h · current {fmtBDT(f.current)} BDT
                  </div>
                  <div className="mt-2">
                    <ConfidenceBadge label={f.confidenceLabel} value={f.confidence} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forecast chart */}
      <div className="surface rounded-xl p-4">
        <SectionTitle
          title="Liquidity Forecast — last 60 min"
          desc="Shared cash + each provider e-money tracked separately. Provider boundaries preserved."
          right={
            <div className="flex items-center gap-3 text-[11px]">
              {(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((code) => (
                <span key={code} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SCOPE_COLORS[code] }} />
                  <span className="text-muted-foreground">{PROVIDERS[code].name}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SCOPE_COLORS.cash }} />
                <span className="text-muted-foreground">Cash</span>
              </span>
            </div>
          }
        />
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(SCOPE_COLORS).map(([scope, color]) => (
                  <linearGradient key={scope} id={`g-${scope}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
              <XAxis dataKey="time" stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [`${fmtBDT(v)} BDT`, name]}
              />
              <ReferenceLine y={maxCap * 0.2} stroke="#f43f5e" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "20% threshold", fontSize: 9, fill: "#fda4af", position: "insideTopLeft" }} />
              {Object.entries(SCOPE_COLORS).map(([scope, color]) => (
                <Area key={scope} type="monotone" dataKey={scope} stroke={color} strokeWidth={2} fill={`url(#g-${scope})`} name={scope === "cash" ? "Cash" : PROVIDERS[scope as keyof typeof PROVIDERS]?.name ?? scope} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Burn rate table */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Burn-rate & Health" desc="Net outflow per scope with data-quality status" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-3 font-medium">Scope</th>
                <th className="py-2 pr-3 font-medium text-right">Balance</th>
                <th className="py-2 pr-3 font-medium text-right">Capacity</th>
                <th className="py-2 pr-3 font-medium text-right">Burn / h</th>
                <th className="py-2 pr-3 font-medium text-right">ETA to 20%</th>
                <th className="py-2 pr-3 font-medium">Feed</th>
                <th className="py-2 pr-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f: any) => {
                const v = views.find((x: any) => x.provider === f.scope);
                const cls = f.scope === "cash" ? providerClasses("cash") : providerClasses(f.scope);
                return (
                  <tr key={f.scope} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", cls.dot)} />
                        <span className="font-medium">{f.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tnum">{fmtBDT(f.current)}</td>
                    <td className="py-2.5 pr-3 text-right tnum text-muted-foreground">{fmtBDT(f.capacity)}</td>
                    <td className={cn("py-2.5 pr-3 text-right tnum", f.burnRatePerHour > 0 ? "text-rose-300" : "text-emerald-300")}>
                      {f.burnRatePerHour > 0 ? `-${fmtBDT(f.burnRatePerHour)}` : `+${fmtBDT(-f.burnRatePerHour)}`}
                    </td>
                    <td className="py-2.5 pr-3 text-right tnum">{fmtHours(f.hoursToShortage)}</td>
                    <td className="py-2.5 pr-3">
                      {v?.isStale ? (
                        <Pill className="border-amber-500/30 text-amber-300 bg-amber-500/10">stale · {(v.latencyMs / 1000).toFixed(0)}s</Pill>
                      ) : (
                        <Pill className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">live</Pill>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <ConfidenceBadge label={f.confidenceLabel} value={f.confidence} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold tnum">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function severityFor(hours: number): string {
  if (hours <= 1) return "text-rose-300 bg-rose-500/15 border-rose-500/30";
  if (hours <= 3) return "text-amber-300 bg-amber-500/15 border-amber-500/30";
  return "text-sky-300 bg-sky-500/15 border-sky-500/30";
}
