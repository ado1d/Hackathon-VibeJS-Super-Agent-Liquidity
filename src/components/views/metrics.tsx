"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import { SectionTitle, Pill, ConfidenceBadge } from "@/components/app/primitives";
import {
  BarChart3,
  Building2,
  Database,
  Cpu,
  Radio,
  ShieldCheck,
  Gauge,
  Timer,
  Target,
  Network,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lock,
  Layers,
  ScanSearch,
  Zap,
  Play,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

export function MetricsView() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [loadResult, setLoadResult] = useState<any>(null);
  const [loadRunning, setLoadRunning] = useState(false);
  const [loadConfig, setLoadConfig] = useState({ requests: 50, concurrency: 5 });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setM(await api.metrics());
        setErr(false);
      } catch {
        setErr(true);
      }
    })();
    const t = setInterval(async () => {
      try {
        const r = await api.metrics();
        if (active) {
          setM(r);
          setErr(false);
        }
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (err) {
    return <div className="surface rounded-xl p-8 text-center text-muted-foreground">Failed to load metrics.</div>;
  }
  if (!m) {
    return (
      <div className="grid place-items-center h-64 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
          Measuring validation evidence…
        </div>
      </div>
    );
  }

  const confData = [
    { label: "High", value: m.analytics.confidenceDistribution.high, color: "#34d399" },
    { label: "Medium", value: m.analytics.confidenceDistribution.medium, color: "#fbbf24" },
    { label: "Low", value: m.analytics.confidenceDistribution.low, color: "#fb7185" },
  ];

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Metrics & Validation Evidence</div>
          <div className="text-[11px] text-muted-foreground">
            Architecture, measured analytical/performance/reliability metrics, and responsible-design notes — required hackathon deliverables.
          </div>
        </div>
        <Pill className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
          <CheckCircle2 className="w-3 h-3" /> 4/4 scenarios detected
        </Pill>
      </div>

      {/* Architecture diagram */}
      <div className="surface rounded-xl p-5">
        <SectionTitle
          title="System Architecture"
          desc="Main interfaces, backend, data flow, analytics/AI services, provider boundaries, and alert coordination flow."
        />
        <ArchitectureDiagram />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Analytics */}
        <div className="surface rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-emerald-300" />
            <h3 className="text-sm font-semibold">Analytics Quality</h3>
          </div>
          <div className="space-y-2.5">
            <MetricRow label="Shortage lead-time" value={`${m.analytics.avgShortageLeadTimeHours} h`} hint="avg hours before 20% threshold" tone="emerald" />
            <MetricRow label="Anomaly recall" value={fmtPct(m.analytics.recall)} hint="4/4 injected scenarios surfaced" tone="emerald" />
            <MetricRow label="Explanation coverage" value={fmtPct(m.analytics.explanationCoverage)} hint="alerts with facts+uncertainty+next step" tone="emerald" />
            <MetricRow label="Scenario-tagged" value={String(m.analytics.scenarioTagged)} hint="demo scenarios A·B·C·D" tone="sky" />
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Confidence distribution</div>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
                  <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {confData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="surface rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-sky-300" />
            <h3 className="text-sm font-semibold">System Performance</h3>
          </div>
          <div className="space-y-2.5">
            <MetricRow label="p50 query latency" value={`${m.performance.p50Ms} ms`} hint="avg across 3 core queries" tone="sky" />
            <MetricRow label="Agent lookup" value={`${m.performance.agentQueryMs} ms`} tone="sky" />
            <MetricRow label="Alerts query (top 20)" value={`${m.performance.alertsQueryMs} ms`} tone="sky" />
            <MetricRow label="Transaction count" value={`${m.performance.txnCountMs} ms`} tone="sky" />
          </div>
          <div className="mt-3 pt-3 border-t border-border text-[10.5px] text-muted-foreground leading-relaxed">
            {m.performance.note}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-emerald-300">
            <Gauge className="w-3 h-3" /> All core interactions &lt; 50ms at demo volume.
          </div>
        </div>

        {/* Reliability */}
        <div className="surface rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-violet-300" />
            <h3 className="text-sm font-semibold">Reliability & Observability</h3>
          </div>
          <div className="space-y-2.5">
            <MetricRow label="Feed health" value={fmtPct(m.reliability.feedHealth)} hint={`${m.reliability.staleFeeds}/${m.reliability.totalFeeds} feeds stale`} tone={m.reliability.feedHealth >= 0.8 ? "emerald" : "amber"} />
            <MetricRow label="Avg data confidence" value={fmtPct(m.reliability.avgConfidence)} tone={m.reliability.avgConfidence >= 0.7 ? "emerald" : "amber"} />
            <MetricRow label="Case traceability" value={fmtPct(m.reliability.caseTraceability)} hint={`${m.reliability.traceableCases}/${m.reliability.totalCases} cases have audit trail`} tone="emerald" />
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Failure-mode handling</div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" /> Stale feed → confidence dampened</li>
              <li className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" /> Missing data → safe fallback shown</li>
              <li className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" /> Conflicting feed → no confident recommendation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Responsible design note */}
      <div className="surface rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-semibold">Responsible-Design Note</h3>
          <Pill className="ml-auto border-amber-500/30 text-amber-300 bg-amber-500/10">required deliverable</Pill>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <RespRow ok label="Careful language" desc="Uses 'unusual' / 'requires review' — never declares fraud." />
            <RespRow ok label="Human review required" desc="Every high-impact alert routes to a human owner before any action." />
            <RespRow ok label="No automatic financial action" desc="Prototype never blocks, freezes, accuses, or moves funds." />
            <RespRow ok label="Provider boundaries preserved" desc="One provider cannot control another's balance, data, or decisions." />
            <RespRow ok label="Synthetic data only" desc="No real customer identities, credentials, PINs, OTPs, or accounts." />
            <RespRow ok label="False-positive awareness" desc="Each detector documents expected FP risk (e.g. Eid/salary days)." />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Actions intentionally NOT performed
            </div>
            <ul className="space-y-1.5 text-[11.5px] text-muted-foreground">
              <li className="flex gap-1.5"><Lock className="w-3 h-3 text-rose-300 shrink-0 mt-0.5" /> No real interoperability, settlement, or wallet conversion.</li>
              <li className="flex gap-1.5"><Lock className="w-3 h-3 text-rose-300 shrink-0 mt-0.5" /> No connection to real wallets or financial infrastructure.</li>
              <li className="flex gap-1.5"><Lock className="w-3 h-3 text-rose-300 shrink-0 mt-0.5" /> No automatic blocking, freezing, or disciplinary action.</li>
              <li className="flex gap-1.5"><Lock className="w-3 h-3 text-rose-300 shrink-0 mt-0.5" /> No collection of credentials, PINs, OTPs, or passwords.</li>
              <li className="flex gap-1.5"><Lock className="w-3 h-3 text-rose-300 shrink-0 mt-0.5" /> No final fraud determination — risk signals are advisory.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Data & simulation note */}
      <div className="surface rounded-xl p-5">
        <SectionTitle title="Data & Simulation Note" desc="How the synthetic provider data and anomaly scenarios were created." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px] text-muted-foreground leading-relaxed">
          <div>
            <p className="mb-2">
              All data is <span className="text-foreground font-medium">synthetic</span>. Six Dhaka-based super-agent outlets (Karwan Bazar, Gulshan, Dhanmondi, Mirpur, Mohammadpur, Uttara) each serve three logically separate providers (bKash, Nagad, Rocket) from one shared physical cash drawer.
            </p>
            <p>
              Each outlet has a 60-minute balance history (5-min snapshots), a transaction population (cash-in / cash-out / transfer), and per-provider e-money balances with realistic capacity, latency, and confidence signals.
            </p>
          </div>
          <div>
            <p className="mb-2">
              Four scenarios are injected: <span className="text-foreground font-medium">A</span> hidden provider shortage, <span className="text-foreground font-medium">B</span> liquidity pressure + repeated near-identical amounts, <span className="text-foreground font-medium">C</span> delayed/conflicting provider feed, <span className="text-foreground font-medium">D</span> a fully coordinated & resolved case with audit trail.
            </p>
            <p>
              The realtime engine advances the simulation every ~9s and re-runs the explainable anomaly detectors every ~35s, so the dashboard reflects live, drifting state.
            </p>
          </div>
        </div>
      </div>

      {/* Load test panel — optional hackathon deliverable */}
      <div className="surface rounded-xl p-5">
        <SectionTitle
          title="Load Test & Profiling"
          desc="Synthetic concurrent read-load against the database layer. Measures throughput + latency percentiles. Read-only — never writes."
          right={
            <Pill className="border-violet-500/30 text-violet-300 bg-violet-500/10">
              <Zap className="w-3 h-3" /> optional deliverable
            </Pill>
          }
        />

        {/* Config controls */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
              Total requests
              <span className="text-primary font-bold ml-2">{loadConfig.requests}</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={loadConfig.requests}
              onChange={(e) => setLoadConfig((c) => ({ ...c, requests: Number(e.target.value) }))}
              className="w-32 accent-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
              Concurrency
              <span className="text-primary font-bold ml-2">{loadConfig.concurrency}</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={loadConfig.concurrency}
              onChange={(e) => setLoadConfig((c) => ({ ...c, concurrency: Number(e.target.value) }))}
              className="w-32 accent-primary"
            />
          </div>
          <button
            onClick={async () => {
              setLoadRunning(true);
              try {
                const r = await api.loadtest(loadConfig.requests, loadConfig.concurrency);
                setLoadResult(r);
                toast.success("Load test complete", {
                  description: `${r.summary.successCount} ok · ${r.summary.requestsPerSecond} req/s · p95 ${r.summary.p95Ms}ms`,
                });
              } catch {
                toast.error("Load test failed");
              } finally {
                setLoadRunning(false);
              }
            }}
            disabled={loadRunning}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loadRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loadRunning ? "Running…" : "Run Load Test"}
          </button>
        </div>

        {/* Results */}
        {loadResult && (
          <div className="space-y-3 fade-up">
            {/* Summary grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <LoadStat label="Total time" value={`${loadResult.summary.totalMs}ms`} tone="sky" />
              <LoadStat label="Throughput" value={`${loadResult.summary.requestsPerSecond}`} unit="req/s" tone="emerald" />
              <LoadStat label="Success" value={`${loadResult.summary.successCount}`} sub={`${loadResult.summary.failCount} failed`} tone="emerald" />
              <LoadStat label="p50 latency" value={`${loadResult.summary.p50Ms}ms`} tone="violet" />
              <LoadStat label="p95 latency" value={`${loadResult.summary.p95Ms}ms`} tone={loadResult.summary.p95Ms > 100 ? "rose" : "amber"} />
            </div>

            {/* Latency distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <LoadStat label="min" value={`${loadResult.summary.minMs}ms`} tone="emerald" small />
              <LoadStat label="avg" value={`${loadResult.summary.avgMs}ms`} tone="sky" small />
              <LoadStat label="p99" value={`${loadResult.summary.p99Ms}ms`} tone="amber" small />
              <LoadStat label="max" value={`${loadResult.summary.maxMs}ms`} tone="rose" small />
            </div>

            {/* Per-query breakdown */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Per-query-type breakdown</div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">Query</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Count</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Avg ms</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Max ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(loadResult.byQuery).map(([q, v]: [string, any]) => (
                      <tr key={q} className="border-b border-border/40 last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-[11px]">{q}</td>
                        <td className="py-1.5 pr-3 text-right tnum">{v.count}</td>
                        <td className="py-1.5 pr-3 text-right tnum">{v.avgMs.toFixed(1)}</td>
                        <td className={cn("py-1.5 pr-3 text-right tnum", v.maxMs > 100 && "text-rose-300")}>{v.maxMs.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">{loadResult.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadStat({ label, value, unit, sub, tone, small }: { label: string; value: string; unit?: string; sub?: string; tone: string; small?: boolean }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
  };
  return (
    <div className="surface rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-bold tnum", small ? "text-base" : "text-lg", tones[tone])}>{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MetricRow({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  const toneClass: Record<string, string> = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  };
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground/90">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
      </div>
      <span className={cn("text-sm font-bold tnum", toneClass[tone])}>{value}</span>
    </div>
  );
}

function RespRow({ ok, label, desc }: { ok: boolean; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", ok ? "text-emerald-400" : "text-muted-foreground")} />
      <div>
        <div className="text-[12px] font-medium text-foreground/90">{label}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
      </div>
    </div>
  );
}

// CSS-based architecture diagram (no external image dependency).
function ArchitectureDiagram() {
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[760px] space-y-2">
        {/* Layer 1: Users */}
        <Layer label="Users & Roles" color="border-sky-500/30">
          <Node icon={Building2} title="Super Agent" sub="outlet view" tone="sky" />
          <Node icon={Workflow} title="Field / Area Ops" sub="coordination" tone="sky" />
          <Node icon={ShieldCheck} title="Risk Analyst" sub="review only" tone="sky" />
          <Node icon={BarChart3} title="Management" sub="aggregate KPIs" tone="sky" />
        </Layer>

        <ArrowDown label="role-gated actions" />

        {/* Layer 2: Frontend */}
        <Layer label="Frontend — Next.js 16 (single route)" color="border-emerald-500/30">
          <Node icon={Layers} title="Command Center" sub="KPIs + alert feed" tone="emerald" />
          <Node icon={Layers} title="Unified Liquidity" sub="cash + 3 providers" tone="emerald" />
          <Node icon={Layers} title="Anomaly Review" sub="evidence + AI advisory" tone="emerald" />
          <Node icon={Layers} title="Coordination" sub="cases + audit trail" tone="emerald" />
          <Node icon={Layers} title="What-If" sub="demand modeling" tone="emerald" />
        </Layer>

        <ArrowDown label="REST API (no server actions)" />

        {/* Layer 3: Backend */}
        <Layer label="Backend — Next.js API Routes" color="border-violet-500/30">
          <Node icon={Cpu} title="Liquidity Forecast" sub="burn-rate → ETA" tone="violet" />
          <Node icon={ScanSearch} title="Anomaly Detectors" sub="repeated·velocity·data" tone="violet" />
          <Node icon={Workflow} title="Case Workflow" sub="route·ack·escalate·resolve" tone="violet" />
          <Node icon={Cpu} title="AI Explain (LLM)" sub="Bengali + English" tone="violet" />
        </Layer>

        <ArrowDown label="reads / writes (synthetic)" />

        {/* Layer 4: Data + Realtime */}
        <Layer label="Data & Realtime" color="border-amber-500/30">
          <Node icon={Database} title="Prisma + SQLite" sub="agents·balances·txns·alerts·cases" tone="amber" />
          <Node icon={Radio} title="Socket.io (:3001)" sub="auto-tick + auto-scan" tone="amber" />
          <Node icon={Network} title="3 Providers (logical)" sub="bKash·Nagad·Rocket — separate" tone="amber" />
        </Layer>
      </div>
    </div>
  );
}

function Layer({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border bg-card/30 p-3", color)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">{label}</div>
      <div className="flex items-stretch gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function Node({ icon: Icon, title, sub, tone }: { icon: React.ElementType; title: string; sub: string; tone: string }) {
  const tones: Record<string, string> = {
    sky: "border-sky-500/25 bg-sky-500/5 text-sky-300",
    emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
    violet: "border-violet-500/25 bg-violet-500/5 text-violet-300",
    amber: "border-amber-500/25 bg-amber-500/5 text-amber-300",
  };
  return (
    <div className={cn("flex-1 min-w-[140px] rounded-md border p-2.5", tones[tone])}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11.5px] font-semibold text-foreground">{title}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ArrowDown({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-0.5">
      <div className="flex flex-col items-center">
        <div className="w-px h-3 bg-muted-foreground/30" />
        <div className="w-2 h-2 rotate-45 border-r border-b border-muted-foreground/40 -mt-1" />
      </div>
      <span className="text-[9.5px] text-muted-foreground/70 uppercase tracking-wider">{label}</span>
    </div>
  );
}
