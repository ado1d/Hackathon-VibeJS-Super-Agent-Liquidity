"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtRel } from "@/lib/format";
import { SectionTitle, Pill } from "@/components/app/primitives";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  FlaskConical,
  Zap,
  ScanSearch,
  RotateCcw,
  AlertTriangle,
  Waves,
  FileWarning,
  ShieldCheck,
  Loader2,
  DatabaseZap,
  Play,
} from "lucide-react";

const SCENARIOS = [
  {
    key: "scenarioA",
    tag: "A",
    title: "Hidden Provider Shortage",
    desc: "Aggregate looks healthy, but one provider e-money is about to run out within ~1.5h.",
    icon: Waves,
    tone: "amber",
  },
  {
    key: "scenarioB",
    tag: "B",
    title: "Liquidity Pressure + Unusual Activity",
    desc: "Physical cash draining fast + repeated near-identical cash-outs from a small customer group (requires review).",
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    key: "scenarioC",
    tag: "C",
    title: "Cross-provider Data Inconsistency",
    desc: "Provider feed delayed / possibly conflicting. Confidence reduced, no confident recommendation.",
    icon: FileWarning,
    tone: "violet",
  },
  {
    key: "scenarioD",
    tag: "D",
    title: "Coordinated Response & Closure",
    desc: "A high-priority alert routed, acknowledged, escalated, and resolved with a full audit trail.",
    icon: ShieldCheck,
    tone: "emerald",
  },
] as const;

export function SimulationView({ onMutate }: { onMutate: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.simulate("tick").catch(() => {});
    refreshLogs();
    const t = setInterval(refreshLogs, 4000);
    return () => clearInterval(t);
  }, []);

  async function refreshLogs() {
    try {
      const r = await fetch("/api/simulate", { cache: "no-store" });
      const j = await r.json();
      setLogs(j.logs ?? []);
    } catch {
      /* ignore */
    }
  }

  async function run(action: string, label: string) {
    setBusy(action);
    try {
      await api.simulate(action);
      toast.success(label);
      onMutate();
      refreshLogs();
    } catch {
      toast.error("Simulation action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <FlaskConical className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Simulation Control</div>
          <div className="text-[11px] text-muted-foreground">
            Trigger the four hackathon demo scenarios, run an explainable anomaly scan, or advance the live tick. All data is synthetic.
          </div>
        </div>
        <Pill className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" /> realtime engine on :3001
        </Pill>
      </div>

      {/* Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const tones: Record<string, string> = {
            amber: "border-amber-500/30 bg-amber-500/5",
            rose: "border-rose-500/30 bg-rose-500/5",
            violet: "border-violet-500/30 bg-violet-500/5",
            emerald: "border-emerald-500/30 bg-emerald-500/5",
          };
          const textTone: Record<string, string> = {
            amber: "text-amber-300",
            rose: "text-rose-300",
            violet: "text-violet-300",
            emerald: "text-emerald-300",
          };
          return (
            <button
              key={s.key}
              onClick={() => run(s.key, `Scenario ${s.tag} re-emphasised`)}
              disabled={busy !== null}
              className={cn("surface surface-hover rounded-xl p-4 text-left border", tones[s.tone], "disabled:opacity-50")}
            >
              <div className="flex items-start gap-3">
                <div className={cn("grid place-items-center w-9 h-9 rounded-lg bg-card/60", textTone[s.tone])}>
                  {busy === s.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", tones[s.tone], textTone[s.tone])}>
                      SCENARIO {s.tag}
                    </span>
                    <span className="text-sm font-semibold truncate">{s.title}</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Quick Actions" desc="Manual control over the simulation engine" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <QuickBtn onClick={() => run("tick", "Live tick advanced")} disabled={busy !== null} icon={Zap} label="Advance Tick" tone="sky" busy={busy === "tick"} />
          <QuickBtn onClick={() => run("scan", "Anomaly scan queued")} disabled={busy !== null} icon={ScanSearch} label="Run Anomaly Scan" tone="violet" busy={busy === "scan"} />
          <QuickBtn onClick={() => run("staleFeed", "Feed health toggled")} disabled={busy !== null} icon={DatabaseZap} label="Toggle Stale Feed" tone="amber" busy={busy === "staleFeed"} />
          <QuickBtn onClick={() => run("reset", "Database re-seeded")} disabled={busy !== null} icon={RotateCcw} label="Reset All Data" tone="rose" busy={busy === "reset"} />
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          The realtime engine already auto-ticks every ~9s and auto-scans every ~35s. These buttons are for manual demo control.
        </p>
      </div>

      {/* Run an explicit anomaly scan via the API */}
      <div className="surface rounded-xl p-4">
        <SectionTitle
          title="Anomaly Scan"
          desc="Run the explainable detectors (repeated amounts · velocity · data conflict) and persist new findings."
          right={
            <button
              onClick={async () => {
                setBusy("scan2");
                try {
                  const r = await api.anomalyScan();
                  toast.success(`Scan complete`, { description: `${r.newAlerts.length} new alert(s) from ${r.scanned} findings.` });
                  onMutate();
                } catch {
                  toast.error("Scan failed");
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy === "scan2" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
              Scan Now
            </button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { name: "repeated_amount", desc: "Near-identical amounts from few customers" },
            { name: "velocity", desc: "Transaction-rate spike vs previous window" },
            { name: "data_conflict", desc: "Stale / delayed / conflicting provider feed" },
          ].map((d) => (
            <div key={d.name} className="rounded-lg border border-border bg-card/30 p-2.5">
              <div className="text-[11px] font-mono text-primary">{d.name}</div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5">{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation log */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Simulation Log" desc="Recent engine activity" />
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto scroll-thin pr-1">
          {logs.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[11.5px] py-1 border-b border-border/40 last:border-0">
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase tracking-wide font-mono">
                {l.scenario}
              </span>
              <span className="text-muted-foreground flex-1 truncate">{l.detail}</span>
              <span className="text-[10px] text-muted-foreground/70">{fmtRel(l.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickBtn({ onClick, disabled, icon: Icon, label, tone, busy }: any) {
  const tones: Record<string, string> = {
    sky: "bg-sky-500/10 text-sky-300 border-sky-500/25 hover:bg-sky-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/25 hover:bg-violet-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/25 hover:bg-rose-500/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("rounded-lg border p-3 text-left transition-colors disabled:opacity-50", tones[tone])}
    >
      <div className="flex items-center gap-2 mb-1">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        <Play className="w-3 h-3 opacity-50" />
      </div>
      <div className="text-xs font-medium">{label}</div>
    </button>
  );
}
