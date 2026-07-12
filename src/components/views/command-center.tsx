"use client";

import { cn } from "@/lib/utils";
import { fmtBDT, fmtPct, fmtRel, severityColor, statusColor, providerClasses } from "@/lib/format";
import { PROVIDERS } from "@/lib/config";
import { KpiCard, SectionTitle, ConfidenceBadge, ProgressBar, Pill, AnimatedNumber } from "@/components/app/primitives";
import { useSaliStore } from "@/lib/store";
import {
  Activity,
  AlertTriangle,
  Wallet,
  Smartphone,
  Gauge,
  FolderCheck,
  ShieldAlert,
  ArrowRight,
  Banknote,
  Radio,
  Sparkles,
  Pin,
  Lightbulb,
  Store,
  MapPin,
  Eye,
  BarChart3,
} from "lucide-react";
import type { ViewKey } from "@/lib/store";

interface Props {
  dashboard: any;
  agents: any[];
  alerts: any[];
  cases: any[];
  onNavigate: (v: ViewKey) => void;
}

export function CommandCenter({ dashboard, agents, alerts, cases, onNavigate }: Props) {
  const pinnedAlerts = useSaliStore((s) => s.pinnedAlerts);
  const role = useSaliStore((s) => s.role);
  if (!dashboard) return null;
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const critical = openAlerts.filter((a) => a.severity === "critical" || a.severity === "high");
  const pinned = alerts.filter((a) => pinnedAlerts.includes(a.id));
  // Sort: scenario-tagged + critical/high first, then by recency.
  const sevRank: Record<string, number> = { critical: 0, high: 1, warning: 2, info: 3 };
  const recentAlerts = [...alerts]
    .sort((a, b) => {
      const aPin = (a.scenarioTag ? 0 : 1) + sevRank[a.severity] * 0.1;
      const bPin = (b.scenarioTag ? 0 : 1) + sevRank[b.severity] * 0.1;
      if (aPin !== bPin) return aPin - bPin;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    })
    .slice(0, 7);
  const openCases = cases.filter((c) => c.status !== "resolved");

  // Alert category summary (collapses the noise into one row)
  const catSummary = {
    liquidity: openAlerts.filter((a) => a.type === "liquidity").length,
    anomaly: openAlerts.filter((a) => a.type === "anomaly").length,
    data_quality: openAlerts.filter((a) => a.type === "data_quality").length,
  };
  const scenarioAlerts = openAlerts.filter((a) => a.scenarioTag);

  // provider-level aggregate pressure
  const providerAgg = (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((code) => {
    const p = PROVIDERS[code];
    const providerAgents = agents.flatMap((a) =>
      (a.providerBalances ?? [])
        .filter((pb: any) => pb.code === code)
        .map((pb: any) => ({ ...pb, agent: a }))
    );
    const totalBal = providerAgents.reduce((s, x) => s + x.balance, 0);
    const totalCap = providerAgents.reduce((s, x) => s + x.capacity, 0);
    const lowCount = providerAgents.filter((x) => x.balance / x.capacity < 0.2).length;
    const staleCount = providerAgents.filter((x) => x.isStale).length;
    const alertCount = openAlerts.filter((a) => a.provider?.code === code).length;
    return { code, name: p.name, color: p.brandColor, totalBal, totalCap, pct: totalBal / totalCap, lowCount, staleCount, alertCount, agentCount: providerAgents.length };
  });

  const totalCash = dashboard.totalCash;
  const totalEmoney = dashboard.totalEmoney;

  return (
    <div className="space-y-5 fade-up">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Active Agents"
          value={<AnimatedNumber value={dashboard.activeAgents} />}
          hint={`${dashboard.degradedAgents} degraded`}
          tone={dashboard.degradedAgents > 0 ? "amber" : "emerald"}
          icon={<Activity className="w-4 h-4" />}
        />
        <KpiCard
          label="Open Alerts"
          value={<AnimatedNumber value={dashboard.openAlerts} />}
          hint={`${dashboard.criticalAlerts} critical/high`}
          tone={dashboard.criticalAlerts > 0 ? "rose" : "emerald"}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <KpiCard
          label="Open Cases"
          value={<AnimatedNumber value={dashboard.openCases} />}
          hint={`${dashboard.resolvedToday} resolved today`}
          tone="violet"
          icon={<FolderCheck className="w-4 h-4" />}
        />
        <KpiCard
          label="Shared Cash"
          value={<AnimatedNumber value={totalCash} format={(n) => fmtBDT(n)} />}
          unit="BDT"
          tone="emerald"
          icon={<Wallet className="w-4 h-4" />}
        />
        <KpiCard
          label="E-Money (3 providers)"
          value={<AnimatedNumber value={totalEmoney} format={(n) => fmtBDT(n)} />}
          unit="BDT"
          tone="sky"
          icon={<Smartphone className="w-4 h-4" />}
        />
        <KpiCard
          label="Avg Confidence"
          value={<AnimatedNumber value={dashboard.avgConfidence} format={(n) => fmtPct(n)} />}
          tone={dashboard.avgConfidence >= 0.7 ? "emerald" : dashboard.avgConfidence >= 0.5 ? "amber" : "rose"}
          icon={<Gauge className="w-4 h-4" />}
        />
      </div>

      {/* Role-specific suggestions — guides each role on what to do next */}
      <RoleSuggestions role={role} alerts={alerts} cases={cases} dashboard={dashboard} onNavigate={onNavigate} />

      {/* Pinned alerts strip — quick access to alerts the user has pinned */}
      {pinned.length > 0 && (
        <div className="surface rounded-xl p-3 border-l-2 border-amber-500/40">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="w-3.5 h-3.5 text-amber-300 fill-current" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Pinned Alerts</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{pinned.length} pinned</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scroll-thin pb-1">
            {pinned.map((a) => {
              const cls = a.provider ? providerClasses(a.provider.code) : providerClasses("cash");
              return (
                <button
                  key={a.id}
                  onClick={() => onNavigate(a.type === "anomaly" || a.type === "data_quality" ? "anomalies" : "coordination")}
                  className={cn("shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-card/40 hover:bg-card/70 transition-colors", cls.border)}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", cls.dot)} />
                  <span className={cn("text-[10px] px-1 py-0.5 rounded border font-medium", severityColor(a.severity))}>{a.severity}</span>
                  <span className="text-[11px] font-medium max-w-[180px] truncate">{a.title}</span>
                  <span className="text-[10px] text-muted-foreground">{a.agent.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenario spotlight — surfaces the 4 demo scenarios for judges */}
      {scenarioAlerts.length > 0 && (
        <div className="surface rounded-xl p-4 border-l-2 border-primary/40">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Demo Scenarios — Live</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{scenarioAlerts.length} active across the network</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(["A", "B", "C", "D"] as const).map((tag) => {
              const a = scenarioAlerts.find((s) => s.scenarioTag === tag);
              const cls = a?.provider ? providerClasses(a.provider.code) : providerClasses("cash");
              const toneMap: Record<string, string> = {
                A: "border-amber-500/30 bg-amber-500/5",
                B: "border-rose-500/30 bg-rose-500/5",
                C: "border-violet-500/30 bg-violet-500/5",
                D: "border-emerald-500/30 bg-emerald-500/5",
              };
              return (
                <button
                  key={tag}
                  onClick={() => onNavigate(a ? (a.type === "liquidity" ? "coordination" : "anomalies") : "simulation")}
                  className={cn("rounded-lg border p-2.5 text-left transition-colors hover:bg-card/60", toneMap[tag], !a && "opacity-40")}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded", toneMap[tag], "text-foreground/80")}>SCENARIO {tag}</span>
                    {a && <span className={cn("w-1.5 h-1.5 rounded-full live-dot", cls.dot)} />}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground leading-snug">
                    {a ? a.title.split("—")[0].trim() : tag === "A" ? "Hidden provider shortage" : tag === "B" ? "Liquidity + unusual activity" : tag === "C" ? "Data inconsistency" : "Coordinated closure"}
                  </div>
                  {a && (
                    <div className={cn("text-[9px] mt-1 font-medium", a.status === "resolved" ? "text-emerald-300" : "text-amber-300")}>
                      {a.status} · {a.agent.code}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider pressure row */}
      <div className="surface rounded-xl p-4">
        <SectionTitle
          title="Provider-level Pressure"
          desc="Aggregate e-money position per provider — boundaries are kept separate, never merged."
          right={
            <button onClick={() => onNavigate("liquidity")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Open liquidity <ArrowRight className="w-3 h-3" />
            </button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {providerAgg.map((p) => {
            const cls = providerClasses(p.code);
            return (
              <div key={p.code} className={cn("rounded-lg border p-3.5 bg-card/40", cls.border)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", cls.dot)} />
                    <span className="font-semibold text-sm">{p.name}</span>
                  </div>
                  <Pill className={cn(cls.bg, cls.border, cls.text)}>{p.agentCount} agents</Pill>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-xl font-bold tnum">{fmtBDT(p.totalBal)}</span>
                  <span className="text-xs text-muted-foreground">/ {fmtBDT(p.totalCap)} BDT</span>
                </div>
                <ProgressBar pct={p.pct} tone={p.code === "bkash" ? "pink" : p.code === "nagad" ? "orange" : "violet"} />
                <div className="flex items-center gap-3 mt-2.5 text-[11px]">
                  <span className={cn(p.lowCount > 0 ? "text-rose-300" : "text-muted-foreground")}>
                    {p.lowCount} low
                  </span>
                  <span className={cn(p.staleCount > 0 ? "text-amber-300" : "text-muted-foreground")}>
                    {p.staleCount} stale
                  </span>
                  <span className={cn(p.alertCount > 0 ? "text-orange-300" : "text-muted-foreground")}>
                    {p.alertCount} alerts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Live alert feed */}
        <div className="lg:col-span-2 surface rounded-xl p-4">
          <SectionTitle
            title="Live Alert Feed"
            desc="Sorted by priority — scenario-tagged & critical first. Advisory only, never fraud."
            right={
              <button onClick={() => onNavigate("anomalies")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                Review all <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          {/* Alert category summary bar — collapses noise into one scannable row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate("anomalies"); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[11px] hover:bg-muted/60 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span className="text-muted-foreground">Liquidity</span>
              <span className="font-bold tnum text-rose-300">{catSummary.liquidity}</span>
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate("anomalies"); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[11px] hover:bg-muted/60 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-muted-foreground">Anomaly</span>
              <span className="font-bold tnum text-amber-300">{catSummary.anomaly}</span>
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate("anomalies"); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-[11px] hover:bg-muted/60 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="text-muted-foreground">Data quality</span>
              <span className="font-bold tnum text-sky-300">{catSummary.data_quality}</span>
            </a>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {scenarioAlerts.length} scenario · {critical.length} critical/high
            </span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto scroll-thin pr-1">
            {recentAlerts.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">No alerts. Network is healthy.</div>
            )}
            {recentAlerts.map((a) => {
              const cls = a.provider ? providerClasses(a.provider.code) : providerClasses("cash");
              return (
                <button
                  key={a.id}
                  onClick={() => onNavigate(a.type === "anomaly" || a.type === "data_quality" ? "anomalies" : "coordination")}
                  className="w-full text-left rounded-lg border border-border bg-card/40 hover:bg-card/70 transition-colors p-3 flex items-start gap-3"
                >
                  <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", cls.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityColor(a.severity))}>
                        {a.severity}
                      </span>
                      {a.scenarioTag && (
                        <Pill className="border-primary/30 text-primary bg-primary/10">Scenario {a.scenarioTag}</Pill>
                      )}
                      {a.provider && (
                        <span className={cn("text-[10px] font-medium", cls.text)}>{a.provider.name}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{fmtRel(a.createdAt)}</span>
                    </div>
                    <div className="text-sm font-medium mt-1 leading-snug">{a.title}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <ConfidenceBadge label={a.confidenceLabel} value={a.confidence} />
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(a.status))}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: cash vs e-money + active cases */}
        <div className="space-y-5">
          <div className="surface rounded-xl p-4">
            <SectionTitle title="Value Mix" desc="Cash vs e-money across the network" />
            <div className="flex items-center gap-4">
              <Donut
                segments={[
                  { label: "Cash", value: totalCash, color: "#34d399" },
                  { label: "bKash", value: providerAgg[0]?.totalBal ?? 0, color: PROVIDERS.bkash.brandColor },
                  { label: "Nagad", value: providerAgg[1]?.totalBal ?? 0, color: PROVIDERS.nagad.brandColor },
                  { label: "Rocket", value: providerAgg[2]?.totalBal ?? 0, color: PROVIDERS.rocket.brandColor },
                ]}
              />
              <div className="flex-1 space-y-1.5">
                <Legend color="#34d399" label="Shared Cash" value={fmtBDT(totalCash)} />
                <Legend color={PROVIDERS.bkash.brandColor} label="bKash" value={fmtBDT(providerAgg[0]?.totalBal ?? 0)} />
                <Legend color={PROVIDERS.nagad.brandColor} label="Nagad" value={fmtBDT(providerAgg[1]?.totalBal ?? 0)} />
                <Legend color={PROVIDERS.rocket.brandColor} label="Rocket" value={fmtBDT(providerAgg[2]?.totalBal ?? 0)} />
              </div>
            </div>
          </div>

          <div className="surface rounded-xl p-4">
            <SectionTitle
              title="Active Cases"
              desc="Coordination in progress"
              right={
                <button onClick={() => onNavigate("coordination")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                  Open <ArrowRight className="w-3 h-3" />
                </button>
              }
            />
            <div className="space-y-2 max-h-[260px] overflow-y-auto scroll-thin pr-1">
              {openCases.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">No open cases.</div>
              )}
              {openCases.slice(0, 6).map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card/40 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(c.status))}>
                      {c.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{c.priority.toUpperCase()}</span>
                    {c.alert.scenarioTag && (
                      <Pill className="border-primary/30 text-primary bg-primary/10 text-[9px]">{c.alert.scenarioTag}</Pill>
                    )}
                  </div>
                  <div className="text-xs font-medium leading-snug line-clamp-2">{c.alert.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Banknote className="w-2.5 h-2.5" />
                    {c.alert.agent.code} · {c.alert.agent.area}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent network strip */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Agent Network" desc="Per-outlet health across Dhaka (synthetic)" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {agents.map((a) => {
            const cashPct = a.cashBalance / a.cashCapacity;
            const lowProviders = (a.providerBalances ?? []).filter((pb: any) => pb.balance / pb.capacity < 0.2).length;
            return (
              <div key={a.id} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", a.status === "active" ? "bg-emerald-400" : "bg-amber-400")} />
                  <span className="text-[10px] text-muted-foreground tnum">{a.code}</span>
                </div>
                <div className="text-xs font-medium leading-tight truncate">{a.area}</div>
                <div className="text-[10px] text-muted-foreground truncate">{a.ownerName}</div>
                <div className="mt-2">
                  <ProgressBar pct={cashPct} tone="emerald" />
                  <div className="flex items-center justify-between mt-1 text-[9.5px] text-muted-foreground">
                    <span>Cash {fmtPct(cashPct)}</span>
                    {lowProviders > 0 && <span className="text-rose-300">{lowProviders} low</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  // Build cumulative offsets with reduce (no reassignment during render).
  const computed = segments.reduce<
    { label: string; value: number; color: string; len: number; dashoffset: number }[]
  >((arr, s) => {
    const len = (s.value / total) * c;
    const prev = arr.length > 0 ? arr[arr.length - 1] : null;
    const dashoffset = prev ? prev.dashoffset - prev.len : 0;
    arr.push({ ...s, len, dashoffset });
    return arr;
  }, []);
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="12" />
      {computed.map((s, i) => (
        <circle
          key={i}
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth="12"
          strokeDasharray={`${s.len} ${c - s.len}`}
          strokeDashoffset={s.dashoffset}
          transform="rotate(-90 48 48)"
          strokeLinecap="butt"
        />
      ))}
      <text x="48" y="46" textAnchor="middle" className="fill-foreground text-[9px] font-semibold">
        Total
      </text>
      <text x="48" y="58" textAnchor="middle" className="fill-muted-foreground text-[7px]">
        {fmtBDT(total)}
      </text>
    </svg>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-medium tnum">{value}</span>
    </div>
  );
}

// --- Role-specific suggestions ---
function RoleSuggestions({ role, alerts, cases, dashboard, onNavigate }: {
  role: string;
  alerts: any[];
  cases: any[];
  dashboard: any;
  onNavigate: (v: any) => void;
}) {
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const openCases = cases.filter((c) => c.status !== "resolved");
  const openOpenCases = cases.filter((c) => c.status === "open");

  const SUGGESTIONS: Record<string, { icon: React.ElementType; tone: string; title: string; items: { text: string; action?: string; urgent?: boolean }[] }> = {
    agent: {
      icon: Store,
      tone: "emerald",
      title: "Your outlet",
      items: [
        { text: `You have ${openAlerts.length} open alert(s) on your outlet. Review and acknowledge the ones that need your attention.`, action: "anomalies", urgent: openAlerts.length > 0 },
        { text: "Check your cash + provider balances. If a shortage is projected, acknowledge and escalate it — you cannot resolve it yourself.", action: "liquidity", urgent: dashboard.criticalAlerts > 0 },
        { text: "You can acknowledge alerts and escalate to Field Ops. You cannot assign or resolve — that's for operations teams.", urgent: false },
      ],
    },
    ops_field: {
      icon: MapPin,
      tone: "sky",
      title: "Field operations",
      items: [
        { text: `${openOpenCases.length} case(s) are waiting to be acknowledged. You're the first responder — review and acknowledge them, then contact the outlet.`, action: "coordination", urgent: openOpenCases.length > 0 },
        { text: `You can acknowledge, escalate, and resolve cases. But you can't assign cases to others — that's the Area Manager's role. Escalate to them when authorised support is needed.`, urgent: openCases.length > 0 },
        { text: "Check the Network Hotspots view to see which outlets are under the most pressure in your territory.", action: "network", urgent: false },
      ],
    },
    ops_area: {
      icon: Activity,
      tone: "violet",
      title: "Area management",
      items: [
        { text: `${dashboard.criticalAlerts} critical/high alert(s) across the area. Coordinate the response — assign cases to field officers and approve authorised support.`, action: "coordination", urgent: dashboard.criticalAlerts > 0 },
        { text: `${openCases.length} open case(s). You have full coordination access — acknowledge, assign, escalate, and resolve. You're the only role that can assign cases.`, action: "coordination", urgent: openCases.length > 0 },
        { text: "Use the What-If Simulator to model demand shocks and the Network Hotspots view to prioritise by area.", action: "whatif", urgent: false },
      ],
    },
    risk: {
      icon: Eye,
      tone: "amber",
      title: "Risk review",
      items: [
        { text: `${openAlerts.length} open alert(s) to review. Examine the evidence — you can acknowledge, escalate, and submit Risk Reviews, but NOT resolve.`, action: "anomalies", urgent: openAlerts.length > 0 },
        { text: "Submit a Risk Review verdict on any case — this is your exclusive capability. Document whether the pattern is likely normal demand or needs deeper investigation. Your verdict is visible to all roles.", action: "coordination", urgent: false },
        { text: "Review the Relationship Graph for cross-provider patterns that may require deeper investigation.", action: "relationships", urgent: false },
      ],
    },
    management: {
      icon: BarChart3,
      tone: "rose",
      title: "Overview",
      items: [
        { text: `Network health: ${dashboard.activeAgents} active agents, ${dashboard.openAlerts} open alerts, ${dashboard.openCases} open cases.`, urgent: false },
        { text: "You have read-only access. Use the Network Hotspots and Metrics views for area-level risk and operational readiness.", action: "network", urgent: false },
        { text: "Individual case coordination is handled by operations teams. You see aggregate KPIs only.", action: "metrics", urgent: false },
      ],
    },
  };

  const s = SUGGESTIONS[role] ?? SUGGESTIONS.ops_area;
  const Icon = s.icon;
  const toneClass: Record<string, string> = {
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
    sky: "border-sky-500/20 bg-sky-500/5 text-sky-300",
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-300",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-300",
  };

  return (
    <div className={cn("rounded-xl border p-4 fade-up", toneClass[s.tone])}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{s.title}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">Suggested actions for your role</span>
      </div>
      <div className="space-y-2">
        {s.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", item.urgent ? "bg-rose-400 live-dot" : "bg-muted-foreground/40")} />
            <span className="text-[12px] text-foreground/80 leading-relaxed flex-1">{item.text}</span>
            {item.action && (
              <button
                onClick={() => onNavigate(item.action as ViewKey)}
                className="shrink-0 text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                Go <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
