"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtPct, providerClasses } from "@/lib/format";
import { PROVIDERS } from "@/lib/config";
import { SectionTitle, Pill, ProgressBar } from "@/components/app/primitives";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend as RLegend,
} from "recharts";
import {
  GitCompare,
  Play,
  Loader2,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Banknote,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

const SCOPE_COLORS: Record<string, string> = {
  cash: "#34d399",
  bkash: "#E2136E",
  nagad: "#EC1C24",
  rocket: "#8B5CF6",
};

export function WhatIfView({
  agents,
  activeAgentId,
}: {
  agents: any[];
  activeAgentId: string | null;
}) {
  const agentId = activeAgentId ?? agents[0]?.id;
  const [providerCode, setProviderCode] = useState<string>("cash");
  const [multiplier, setMultiplier] = useState<number>(2);
  const [hours, setHours] = useState<number>(4);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!agentId) return;
    setLoading(true);
    try {
      const r = await api.whatif(agentId, providerCode, multiplier, hours);
      setResult(r);
      toast.success("What-If projection complete", {
        description: r.wouldShortage
          ? `Shortage projected in ~${r.shortageHour}h at ${multiplier}× demand`
          : `Stays above threshold at ${multiplier}× demand`,
      });
    } catch {
      toast.error("Projection failed");
    } finally {
      setLoading(false);
    }
  }

  // auto-run on mount + when inputs change (debounced)
  useEffect(() => {
    if (!agentId) return;
    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [agentId, providerCode, multiplier, hours]);

  const scopeOptions = [
    { code: "cash", name: "Shared Cash", icon: Banknote },
    ...Object.values(PROVIDERS).map((p) => ({ code: p.code, name: p.name, icon: Smartphone })),
  ];

  const chartData = result?.series?.map((s: any) => ({
    hour: `+${s.hour}h`,
    baseline: s.baseline,
    shocked: s.shocked,
  })) ?? [];

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <GitCompare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">What-If Simulator</div>
          <div className="text-[11px] text-muted-foreground">
            Model a demand shock (festival / payday / ATM outage) and project the impact on a single provider's liquidity. Safe decision-support — forecasts only, never executes.
          </div>
        </div>
        <Pill className="border-amber-500/30 text-amber-300 bg-amber-500/10">
          <ShieldCheck className="w-3 h-3" /> advisory only
        </Pill>
      </div>

      {/* Controls */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Scenario Parameters" desc="Pick a scope, demand multiplier, and time horizon." />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Scope selector */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Scope</label>
            <div className="grid grid-cols-2 gap-1.5">
              {scopeOptions.map((s) => {
                const Icon = s.icon;
                const active = providerCode === s.code;
                const cls = providerClasses(s.code);
                return (
                  <button
                    key={s.code}
                    onClick={() => setProviderCode(s.code)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium border transition-colors",
                      active
                        ? cn(cls.bg, cls.border, cls.text)
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demand multiplier */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Demand multiplier</span>
              <span className="text-primary font-bold tnum text-sm">{multiplier.toFixed(1)}×</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0.5× (low)</span>
              <span>1× (normal)</span>
              <span>5× (festival)</span>
            </div>
            <div className="flex gap-1 mt-2">
              {[1, 1.5, 2, 3].map((m) => (
                <button
                  key={m}
                  onClick={() => setMultiplier(m)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                    multiplier === m
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Time horizon</span>
              <span className="text-primary font-bold tnum text-sm">{hours}h</span>
            </label>
            <input
              type="range"
              min={1}
              max={24}
              step={1}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>1h</span>
              <span>12h</span>
              <span>24h</span>
            </div>
            <div className="flex gap-1 mt-2">
              {[2, 4, 8, 12].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                    hours === h
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={run}
            disabled={loading || !agentId}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Projection
          </button>
          {result && (
            <span className="text-[11px] text-muted-foreground">
              Projecting <span className="text-foreground font-medium">{result.label}</span> for{" "}
              <span className="text-foreground font-medium">{result.agent.name}</span> ({result.agent.area})
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Outcome cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <OutcomeCard
              label="Current balance"
              value={fmtBDT(result.current)}
              unit="BDT"
              tone="emerald"
              icon={Banknote}
            />
            <OutcomeCard
              label="Shocked burn rate"
              value={fmtBDT(result.shockedBurnPerHour)}
              unit="BDT/h"
              tone={result.shockedBurnPerHour > result.baseBurnPerHour ? "rose" : "emerald"}
              icon={TrendingDown}
              sub={`baseline ${fmtBDT(result.baseBurnPerHour)}/h`}
            />
            <OutcomeCard
              label={`Projected in ${hours}h`}
              value={fmtBDT(result.projectedFinal)}
              unit="BDT"
              tone={result.projectedFinal <= result.threshold ? "rose" : "amber"}
              icon={Sparkles}
            />
            <OutcomeCard
              label="Shortage ETA"
              value={result.shortageHour !== null ? `~${result.shortageHour}h` : "Safe"}
              tone={result.wouldShortage ? "rose" : "emerald"}
              icon={result.wouldShortage ? AlertTriangle : ShieldCheck}
              sub={result.wouldShortage ? `below 20% threshold` : `stays above 20%`}
            />
          </div>

          {/* Chart */}
          <div className="surface rounded-xl p-4">
            <SectionTitle
              title="Projected Balance Curve"
              desc={`Baseline vs ${multiplier}× demand shock over ${hours} hours. Dashed line = 20% shortage threshold.`}
              right={
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SCOPE_COLORS[providerCode] ?? "#34d399" }} />
                    <span className="text-muted-foreground">Baseline</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                    <span className="text-muted-foreground">{multiplier}× demand</span>
                  </span>
                </div>
              }
            />
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
                  <XAxis dataKey="hour" stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${fmtBDT(v)} BDT`, name]}
                  />
                  <ReferenceLine y={result.threshold} stroke="#f43f5e" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `20% threshold (${fmtBDT(result.threshold)})`, fontSize: 9, fill: "#fda4af", position: "insideTopLeft" }} />
                  <Line type="monotone" dataKey="baseline" stroke={SCOPE_COLORS[providerCode] ?? "#34d399"} strokeWidth={2} dot={false} name="Baseline" />
                  <Line type="monotone" dataKey="shocked" stroke="#fb7185" strokeWidth={2.5} strokeDasharray="5 3" dot={false} name={`${multiplier}× demand`} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Safe recommendation */}
          <div className={cn("surface rounded-xl p-4 border-l-2", result.wouldShortage ? "border-rose-500/50 bg-rose-500/5" : "border-emerald-500/50 bg-emerald-500/5")}>
            <div className="flex items-start gap-3">
              <div className={cn("grid place-items-center w-9 h-9 rounded-lg shrink-0", result.wouldShortage ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>
                {result.wouldShortage ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className={cn("text-sm font-semibold mb-1", result.wouldShortage ? "text-rose-300" : "text-emerald-300")}>
                  {result.wouldShortage ? "Shortage projected — coordinate support" : "No shortage projected — continue monitoring"}
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{result.safeNote}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  This projection is advisory. The prototype does not execute transfers, refills, or any financial action.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="surface rounded-xl p-8 text-center text-muted-foreground text-sm">
          Set parameters above and run a projection.
        </div>
      )}
    </div>
  );
}

function OutcomeCard({ label, value, unit, tone, icon: Icon, sub }: any) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300 border-emerald-500/20",
    rose: "text-rose-300 border-rose-500/20",
    amber: "text-amber-300 border-amber-500/20",
  };
  return (
    <div className={cn("surface rounded-xl p-4 border", tones[tone])}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", tones[tone])} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-bold tnum", tones[tone])}>{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
