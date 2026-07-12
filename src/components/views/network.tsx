"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtPct } from "@/lib/format";
import { PROVIDERS } from "@/lib/config";
import { SectionTitle, Pill, ProgressBar, AnimatedNumber } from "@/components/app/primitives";
import {
  MapPin,
  Map,
  Navigation,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
  Handshake,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface AgentNode {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  area: string;
  thana: string;
  district: string;
  lat: number;
  lng: number;
  status: string;
  cashBalance: number;
  cashCapacity: number;
  cashPct: number;
  providerBalances: { code: string; name: string; brandColor: string; balance: number; capacity: number; pct: number; isStale: boolean; confidence: number }[];
  avgProvPct: number;
  lowProviders: number;
  staleProviders: number;
  alertCount: number;
  criticalAlerts: number;
  pressureScore: number;
  healthLabel: string;
}

interface Hotspot {
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
  avgPressure: number;
  cashPct: number;
  emoneyPct: number;
  healthLabel: string;
  agents: { code: string; name: string; pressureScore: number; healthLabel: string }[];
}

export function NetworkView({ agents: agentList }: { agents: any[] }) {
  const [data, setData] = useState<{ agents: AgentNode[]; nearby: Record<string, any[]>; hotspots: Hotspot[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.network();
      setData(r);
      if (!selected && r.agents.length > 0) setSelected(r.agents[0].code);
    } catch {
      toast.error("Failed to load network data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) {
    return (
      <div className="grid place-items-center h-64 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Mapping network hotspots…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const sel = data.agents.find((a) => a.code === selected) ?? data.agents[0];
  const selNearby = data.nearby[sel?.code] ?? [];

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <Map className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Network Hotspots & Nearby Support</div>
          <div className="text-[11px] text-muted-foreground">
            Area-wise pressure prioritization, agent geo-map, and nearby-agent support discovery. All coordinates are synthetic Dhaka locations.
          </div>
        </div>
        <button onClick={load} className="grid place-items-center w-8 h-8 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors" title="Refresh">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <SummaryStat label="Total Agents" value={data.summary.totalAgents} icon={Users} tone="sky" />
        <SummaryStat label="Healthy" value={data.summary.healthy} icon={ShieldCheck} tone="emerald" />
        <SummaryStat label="Watch" value={data.summary.watch} icon={Info} tone="sky" />
        <SummaryStat label="Pressured" value={data.summary.pressured} icon={TrendingUp} tone="amber" />
        <SummaryStat label="Critical" value={data.summary.critical} icon={AlertTriangle} tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Map + agent list */}
        <div className="lg:col-span-3 space-y-4">
          {/* SVG Map */}
          <div className="surface rounded-xl p-4">
            <SectionTitle title="Agent Geo-Map" desc="Synthetic Dhaka outlets — dot size = pressure, color = health. Click a dot to inspect." />
            <DhakaMap agents={data.agents} selected={selected} onSelect={setSelected} />
          </div>

          {/* Area hotspots */}
          <div className="surface rounded-xl p-4">
            <SectionTitle
              title="Area Hotspot Ranking"
              desc="Areas ranked by combined pressure (cash + provider + stale feeds + alerts)."
              right={
                <Pill className="border-primary/30 text-primary bg-primary/10">
                  avg pressure <AnimatedNumber value={data.summary.avgPressure} format={(n) => String(Math.round(n))} />
                </Pill>
              }
            />
            <div className="space-y-2 max-h-[320px] overflow-y-auto scroll-thin pr-1">
              {data.hotspots.map((h, i) => (
                <div
                  key={h.area}
                  className={cn(
                    "rounded-lg border p-3 flex items-center gap-3 transition-colors cursor-pointer",
                    healthBorder(h.healthLabel),
                    "hover:bg-card/70"
                  )}
                  onClick={() => {
                    const a = data.agents.find((x) => x.area === h.area);
                    if (a) setSelected(a.code);
                  }}
                >
                  <span className={cn("grid place-items-center w-7 h-7 rounded-md text-[11px] font-bold shrink-0", healthBg(h.healthLabel), healthText(h.healthLabel))}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{h.area}</span>
                      <Pill className={cn("text-[9px]", healthBorder(h.healthLabel), healthBg(h.healthLabel), healthText(h.healthLabel))}>
                        {h.healthLabel}
                      </Pill>
                      <span className="text-[10px] text-muted-foreground ml-auto">{h.agentCount} agents</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10.5px]">
                      <span className="text-muted-foreground">Cash <span className={cn("font-medium tnum", h.cashPct < 0.2 ? "text-rose-300" : "text-foreground")}>{fmtPct(h.cashPct)}</span></span>
                      <span className="text-muted-foreground">E-Money <span className={cn("font-medium tnum", h.emoneyPct < 0.2 ? "text-rose-300" : "text-foreground")}>{fmtPct(h.emoneyPct)}</span></span>
                      {h.lowProviders > 0 && <span className="text-rose-300">{h.lowProviders} low</span>}
                      {h.staleProviders > 0 && <span className="text-amber-300">{h.staleProviders} stale</span>}
                      {h.alertCount > 0 && <span className="text-orange-300">{h.alertCount} alerts</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn("text-lg font-bold tnum", healthText(h.healthLabel))}>
                      <AnimatedNumber value={h.avgPressure} />
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">pressure</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected agent detail + nearby */}
        <div className="lg:col-span-2 space-y-4">
          {sel && (
            <>
              <div className="surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className={cn("w-4 h-4", healthText(sel.healthLabel))} />
                  <h3 className="text-sm font-semibold">{sel.name}</h3>
                  <Pill className={cn("ml-auto text-[9px]", healthBorder(sel.healthLabel), healthBg(sel.healthLabel), healthText(sel.healthLabel))}>
                    {sel.healthLabel}
                  </Pill>
                </div>
                <div className="text-[11px] text-muted-foreground mb-3">
                  {sel.code} · {sel.area}, {sel.thana} · {sel.ownerName}
                </div>

                {/* Pressure gauge */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Pressure score</span>
                    <span className={cn("font-bold tnum text-sm", healthText(sel.healthLabel))}>
                      <AnimatedNumber value={sel.pressureScore} />/100
                    </span>
                  </div>
                  <PressureBar score={sel.pressureScore} />
                </div>

                {/* Cash + providers */}
                <div className="space-y-2">
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Shared Cash</span>
                      <span className="font-medium tnum">{fmtBDT(sel.cashBalance)} BDT</span>
                    </div>
                    <ProgressBar pct={sel.cashPct} tone="emerald" />
                  </div>
                  {sel.providerBalances.map((p) => (
                    <div key={p.code} className={cn("rounded-md border p-2", p.isStale ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card/30")}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: p.brandColor }} />
                          <span className="text-muted-foreground">{p.name}</span>
                          {p.isStale && <span className="text-[9px] text-amber-300">stale</span>}
                        </span>
                        <span className="font-medium tnum">{fmtBDT(p.balance)} BDT</span>
                      </div>
                      <ProgressBar pct={p.pct} tone={p.code === "bkash" ? "pink" : p.code === "nagad" ? "orange" : "violet"} />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">{sel.alertCount} alerts</span>
                  {sel.criticalAlerts > 0 && <span className="text-rose-300">· {sel.criticalAlerts} critical</span>}
                  {sel.staleProviders > 0 && <span className="text-amber-300">· {sel.staleProviders} stale</span>}
                </div>
              </div>

              {/* Nearby-agent support discovery */}
              <div className="surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Handshake className="w-4 h-4 text-emerald-300" />
                  <h3 className="text-sm font-semibold">Nearby Support</h3>
                  <Pill className="ml-auto border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[9px]">within 8 km</Pill>
                </div>
                <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
                  When an outlet is under pressure, a field officer can discover nearby agents who may share load through <span className="text-foreground">authorised provider channels</span>. No automatic transfers.
                </p>
                {selNearby.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center rounded-md border border-dashed border-border">
                    No other outlets within 8 km. Escalate to area manager.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto scroll-thin pr-1">
                    {selNearby.map((n) => (
                      <div
                        key={n.code}
                        className="rounded-lg border border-border bg-card/40 p-2.5 hover:bg-card/70 transition-colors cursor-pointer"
                        onClick={() => setSelected(n.code)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Navigation className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[12px] font-medium">{n.area}</span>
                          <span className="text-[10px] text-muted-foreground">{n.code}</span>
                          <span className="ml-auto text-[11px] font-bold tnum text-emerald-300">{n.distanceKm} km</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <Pill className={cn("text-[9px]", healthBorder(n.healthLabel), healthBg(n.healthLabel), healthText(n.healthLabel))}>
                            {n.healthLabel}
                          </Pill>
                          <span className="text-muted-foreground">pressure {n.pressureScore}</span>
                          <span className={cn("ml-auto", n.cashPct > 0.5 ? "text-emerald-300" : n.cashPct > 0.2 ? "text-amber-300" : "text-rose-300")}>
                            cash {fmtPct(n.cashPct)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-start gap-1.5 text-[9.5px] text-muted-foreground leading-relaxed">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  Support coordination is advisory only. The prototype never moves funds across providers or wallets.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SVG map of Dhaka with agent pins --------------------------------------
// Coords are normalized from lat/lng into the SVG viewBox. Since all agents
// are in Dhaka, we map the bounding box to the canvas with padding.
function DhakaMap({ agents, selected, onSelect }: { agents: AgentNode[]; selected: string | null; onSelect: (code: string) => void }) {
  if (agents.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No agents.</div>;

  const lats = agents.map((a) => a.lat);
  const lngs = agents.map((a) => a.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 520, H = 320, pad = 40;

  const project = (lat: number, lng: number) => {
    const x = pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad);
    const y = H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - 2 * pad);
    return { x, y };
  };

  return (
    <div className="relative w-full overflow-x-auto scroll-thin">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" style={{ maxHeight: 340 }}>
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" className="text-muted/15" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) / 2.2} fill="url(#mapGlow)" />

        {/* Dhaka label */}
        <text x={W / 2} y={24} textAnchor="middle" className="fill-muted-foreground" fontSize="11" fontWeight="600" letterSpacing="2">
          DHAKA — AGENT NETWORK
        </text>
        <text x={W / 2} y={H - 12} textAnchor="middle" className="fill-muted-foreground/50" fontSize="8">
          synthetic coordinates · not to scale
        </text>

        {/* Connection lines between nearby agents (light) */}
        {agents.map((a, i) => {
          const pa = project(a.lat, a.lng);
          return agents.slice(i + 1).map((b) => {
            const pb = project(b.lat, b.lng);
            const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
            if (dist > 180) return null;
            return <line key={`${a.code}-${b.code}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="currentColor" className="text-muted/15" strokeWidth="0.5" strokeDasharray="2 3" />;
          });
        })}

        {/* Agent pins */}
        {agents.map((a) => {
          const { x, y } = project(a.lat, a.lng);
          const isSel = selected === a.code;
          const r = 6 + (a.pressureScore / 100) * 10;
          const color = healthHex(a.healthLabel);
          return (
            <g key={a.code} onClick={() => onSelect(a.code)} style={{ cursor: "pointer" }}>
              {/* pulse for critical */}
              {a.healthLabel === "critical" && (
                <circle cx={x} cy={y} r={r + 6} fill={color} opacity="0.2" className="live-dot" />
              )}
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity="0.25" stroke={color} strokeWidth={isSel ? 2.5 : 1.5} />
              <circle cx={x} cy={y} r={3} fill={color} />
              {isSel && (
                <>
                  <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
                  <g transform={`translate(${x + r + 6}, ${y - 8})`}>
                    <rect x="0" y="-10" width={a.area.length * 6 + 16} height="20" rx="4" fill="var(--popover)" stroke="var(--border)" />
                    <text x="6" y="3" className="fill-foreground" fontSize="9" fontWeight="600">{a.area}</text>
                  </g>
                </>
              )}
              <text x={x} y={y + r + 11} textAnchor="middle" className="fill-muted-foreground" fontSize="7.5">{a.code.split("-")[1]}</text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${W - 130}, ${H - 60})`}>
          <rect x="0" y="0" width="120" height="50" rx="4" fill="var(--card)" stroke="var(--border)" fillOpacity="0.8" />
          {[
            { label: "healthy", color: healthHex("healthy") },
            { label: "pressured", color: healthHex("pressured") },
            { label: "critical", color: healthHex("critical") },
          ].map((l, i) => (
            <g key={l.label} transform={`translate(8, ${10 + i * 12})`}>
              <circle cx="4" cy="0" r="3" fill={l.color} />
              <text x="12" y="3" className="fill-muted-foreground" fontSize="8">{l.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------
function healthHex(label: string): string {
  switch (label) {
    case "healthy":
      return "#34d399";
    case "watch":
      return "#38bdf8";
    case "pressured":
      return "#fbbf24";
    case "critical":
      return "#fb7185";
    default:
      return "#94a3b8";
  }
}
function healthText(label: string): string {
  switch (label) {
    case "healthy":
      return "text-emerald-300";
    case "watch":
      return "text-sky-300";
    case "pressured":
      return "text-amber-300";
    case "critical":
      return "text-rose-300";
    default:
      return "text-muted-foreground";
  }
}
function healthBg(label: string): string {
  switch (label) {
    case "healthy":
      return "bg-emerald-500/10";
    case "watch":
      return "bg-sky-500/10";
    case "pressured":
      return "bg-amber-500/10";
    case "critical":
      return "bg-rose-500/10";
    default:
      return "bg-muted/40";
  }
}
function healthBorder(label: string): string {
  switch (label) {
    case "healthy":
      return "border-emerald-500/25";
    case "watch":
      return "border-sky-500/25";
    case "pressured":
      return "border-amber-500/25";
    case "critical":
      return "border-rose-500/25";
    default:
      return "border-border";
  }
}

function PressureBar({ score }: { score: number }) {
  const color = score >= 60 ? "#fb7185" : score >= 35 ? "#fbbf24" : score >= 15 ? "#38bdf8" : "#34d399";
  return (
    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

function SummaryStat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <div className="surface rounded-lg p-3 flex items-center gap-2.5">
      <Icon className={cn("w-4 h-4", tones[tone])} />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-lg font-bold tnum", tones[tone])}>
          <AnimatedNumber value={value} />
        </div>
      </div>
    </div>
  );
}
