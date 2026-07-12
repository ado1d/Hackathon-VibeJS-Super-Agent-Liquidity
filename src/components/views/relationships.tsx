"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtPct } from "@/lib/format";
import { SectionTitle, Pill, AnimatedNumber } from "@/components/app/primitives";
import { CustomerDetailDialog } from "@/components/views/customer-detail";
import {
  Share2,
  Users,
  AlertOctagon,
  ShieldCheck,
  Loader2,
  RefreshCw,
  MapPin,
  TrendingUp,
  Info,
} from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: "provider" | "customer";
  color?: string;
  providerCount?: number;
  agentCount?: number;
  txnCount?: number;
  totalValue?: number;
  hasAnomaly?: boolean;
  providers?: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  value: number;
  isAnomaly: boolean;
}

export function RelationshipsView({ agents }: { agents: any[] }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; customers: any[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  async function load() {
    try {
      const r = await api.relationships();
      setData(r);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  // Compute node positions for the graph.
  // Providers are placed in a fixed triangle; customers are arranged in a
  // circle around the center, pulled toward their connected providers.
  const layout = useMemo(() => {
    if (!data) return { nodes: [] as { id: string; x: number; y: number; node: GraphNode }[], edges: [] as { x1: number; y1: number; x2: number; y2: number; edge: GraphEdge }[] };
    const W = 560, H = 420, cx = W / 2, cy = H / 2;
    const providers = data.nodes.filter((n) => n.type === "provider");
    const customers = data.nodes.filter((n) => n.type === "customer");

    // Providers in a triangle
    const provPos = new Map<string, { x: number; y: number }>();
    providers.forEach((p, i) => {
      const angle = (i / providers.length) * Math.PI * 2 - Math.PI / 2;
      const r = 130;
      provPos.set(p.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    });

    // Customers in a ring, offset toward their providers' centroid
    const custPos = new Map<string, { x: number; y: number }>();
    customers.forEach((c, i) => {
      const angle = (i / Math.max(1, customers.length)) * Math.PI * 2;
      const ringR = 190;
      const baseX = cx + Math.cos(angle) * ringR;
      const baseY = cy + Math.sin(angle) * ringR;
      // pull toward provider centroid
      const cProvs = c.providers ?? [];
      if (cProvs.length > 0) {
        const px = cProvs.reduce((s, id) => s + (provPos.get(id)?.x ?? cx), 0) / cProvs.length;
        const py = cProvs.reduce((s, id) => s + (provPos.get(id)?.y ?? cy), 0) / cProvs.length;
        custPos.set(c.id, { x: baseX * 0.55 + px * 0.45, y: baseY * 0.55 + py * 0.45 });
      } else {
        custPos.set(c.id, { x: baseX, y: baseY });
      }
    });

    const allPos = new Map<string, { x: number; y: number }>([...provPos, ...custPos]);
    const nodes = data.nodes.map((n) => ({ id: n.id, x: allPos.get(n.id)?.x ?? cx, y: allPos.get(n.id)?.y ?? cy, node: n }));
    const edges = data.edges.map((e) => ({
      x1: allPos.get(e.source)?.x ?? cx,
      y1: allPos.get(e.source)?.y ?? cy,
      x2: allPos.get(e.target)?.x ?? cx,
      y2: allPos.get(e.target)?.y ?? cy,
      edge: e,
    }));
    return { nodes, edges };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="grid place-items-center h-64 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Building relationship graph…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const sel = data.customers.find((c) => c.id === selected);

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Cross-Provider Relationship Graph</div>
          <div className="text-[11px] text-muted-foreground">
            Customers who transact across multiple providers (simulated IDs only). Shows network patterns — never declares fraud. Privacy-preserving: no real identities.
          </div>
        </div>
        <button onClick={load} className="grid place-items-center w-8 h-8 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors" title="Refresh">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Total Customers" value={<AnimatedNumber value={data.summary.totalCustomers} />} icon={Users} tone="sky" />
        <StatCard label="Cross-Provider" value={<AnimatedNumber value={data.summary.crossProviderCustomers} />} hint={fmtPct(data.summary.crossProviderPct)} icon={Share2} tone="violet" />
        <StatCard label="Multi-Agent" value={<AnimatedNumber value={data.summary.multiAgentCustomers} />} icon={MapPin} tone="emerald" />
        <StatCard label="With Flags" value={<AnimatedNumber value={data.summary.anomalyCustomers} />} icon={AlertOctagon} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Graph */}
        <div className="lg:col-span-3 surface rounded-xl p-4">
          <SectionTitle title="Network Graph" desc="Providers (triangle) ↔ customers (ring). Edge thickness = transaction count. Dashed red = anomaly-flagged." />
          <div className="relative w-full overflow-x-auto scroll-thin">
            <svg viewBox="0 0 560 420" className="w-full min-w-[480px]" style={{ maxHeight: 420 }}>
              <defs>
                <pattern id="relGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" className="text-muted/10" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="560" height="420" fill="url(#relGrid)" />

              {/* Edges */}
              {layout.edges.map((e, i) => {
                const isSel = selected && (e.edge.source === selected || e.edge.target === selected);
                return (
                  <line
                    key={i}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke={e.edge.isAnomaly ? "#fb7185" : isSel ? "#34d399" : "#64748b"}
                    strokeWidth={Math.min(4, 1 + e.edge.weight * 0.4)}
                    strokeOpacity={isSel ? 0.8 : e.edge.isAnomaly ? 0.5 : 0.2}
                    strokeDasharray={e.edge.isAnomaly ? "4 3" : undefined}
                  />
                );
              })}

              {/* Nodes */}
              {layout.nodes.map((n) => {
                const isProvider = n.node.type === "provider";
                const isSel = selected === n.id;
                const r = isProvider ? 22 : n.node.hasAnomaly ? 9 : 6;
                const fill = isProvider ? n.node.color ?? "#34d399" : n.node.hasAnomaly ? "#fb7185" : "#64748b";
                return (
                  <g key={n.id} onClick={() => !isProvider && setSelected(isSel ? null : n.id)} style={{ cursor: isProvider ? "default" : "pointer" }}>
                    {n.node.hasAnomaly && (
                      <circle cx={n.x} cy={n.y} r={r + 5} fill={fill} opacity="0.15" className="live-dot" />
                    )}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill={fill}
                      fillOpacity={isProvider ? 0.2 : 0.3}
                      stroke={fill}
                      strokeWidth={isSel ? 2.5 : isProvider ? 2 : 1.5}
                    />
                    {isProvider && (
                      <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={fill}>
                        {n.node.label}
                      </text>
                    )}
                    {isSel && !isProvider && (
                      <g transform={`translate(${n.x + 10}, ${n.y - 6})`}>
                        <rect x="0" y="-9" width={n.id.length * 6 + 8} height="16" rx="3" fill="var(--popover)" stroke="var(--border)" />
                        <text x="4" y="2" fontSize="8" className="fill-foreground" fontFamily="monospace">{n.id}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Legend */}
              <g transform="translate(12, 392)">
                <rect x="0" y="-18" width="180" height="26" rx="4" fill="var(--card)" stroke="var(--border)" fillOpacity="0.8" />
                <circle cx="12" cy="-8" r="5" fill="#34d399" fillOpacity="0.3" stroke="#34d399" strokeWidth="1.5" />
                <text x="22" y="-5" fontSize="8" className="fill-muted-foreground">customer</text>
                <circle cx="80" cy="-8" r="5" fill="#fb7185" fillOpacity="0.3" stroke="#fb7185" strokeWidth="1.5" />
                <text x="90" y="-5" fontSize="8" className="fill-muted-foreground">flagged</text>
                <line x1="130" y1="-8" x2="150" y2="-8" stroke="#fb7185" strokeWidth="2" strokeDasharray="3 2" />
                <text x="154" y="-5" fontSize="8" className="fill-muted-foreground">anomaly edge</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Customer list + detail */}
        <div className="lg:col-span-2 space-y-4">
          {sel ? (
            <div className="surface rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-violet-300" />
                <h3 className="text-sm font-semibold font-mono">{sel.id}</h3>
                {sel.hasAnomaly && (
                  <Pill className="ml-auto border-amber-500/30 text-amber-300 bg-amber-500/10 text-[9px]">
                    <AlertOctagon className="w-2.5 h-2.5" /> flagged
                  </Pill>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Mini label="Providers" value={sel.providerCount} />
                <Mini label="Agents" value={sel.agentCount} />
                <Mini label="Transactions" value={sel.txnCount} />
                <Mini label="Total Value" value={fmtBDT(sel.totalValue)} unit="BDT" />
              </div>
              <div className="text-[11px] text-muted-foreground mb-2">Connected providers:</div>
              <div className="flex flex-wrap gap-1.5">
                {sel.providers.map((p: string) => (
                  <Pill key={p} className={cn("text-[10px]", providerPill(p))}>{p}</Pill>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                This is a simulated identifier. Cross-provider activity is a pattern insight, not proof of wrongdoing. Human review required.
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-3 w-full px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                Back to list
              </button>
              <button
                onClick={() => setDetailOpen(true)}
                className="mt-1.5 w-full px-3 py-1.5 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors flex items-center justify-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" /> View full transaction history
              </button>
              <CustomerDetailDialog customerId={sel.id} open={detailOpen} onOpenChange={setDetailOpen} />
            </div>
          ) : (
            <div className="surface rounded-xl p-4">
              <SectionTitle title="Cross-Provider Customers" desc="Sorted by provider count then value. Click to inspect." />
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto scroll-thin pr-1">
                {data.customers.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">No cross-provider customers found yet.</div>
                )}
                {data.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-colors",
                      c.hasAnomaly ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10" : "border-border bg-card/40 hover:bg-card/70"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-medium">{c.id}</span>
                      {c.hasAnomaly && <AlertOctagon className="w-3 h-3 text-amber-300" />}
                      <span className="ml-auto text-[10px] text-muted-foreground">{c.txnCount} txns</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-violet-300 font-medium">{c.providerCount} providers</span>
                      <span className="text-emerald-300">{c.agentCount} agents</span>
                      <span className="ml-auto tnum text-muted-foreground">{fmtBDT(c.totalValue)} BDT</span>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {c.providers.map((p: string) => (
                        <span key={p} className={cn("w-1.5 h-1.5 rounded-full", providerDot(p))} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Insight box */}
          <div className="surface rounded-xl p-4 border-l-2 border-violet-500/40">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">Pattern Insight</span>
            </div>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              {data.summary.crossProviderCustomers} of {data.summary.totalCustomers} customers ({fmtPct(data.summary.crossProviderPct)}) transact across multiple providers. This is normal multi-wallet behavior — but combined with anomaly flags or concentrated amounts, it may warrant review.
            </p>
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              Cross-provider insight helps operations understand network flow — it never triggers automatic action.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: React.ReactNode; hint?: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  };
  return (
    <div className="surface rounded-lg p-3 flex items-center gap-2.5">
      <Icon className={cn("w-4 h-4", tones[tone])} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-lg font-bold tnum", tones[tone])}>{value}</span>
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/30 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold tnum">{value}</span>
        {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function providerDot(code: string): string {
  switch (code) {
    case "bkash":
      return "bg-pink-400";
    case "nagad":
      return "bg-orange-400";
    case "rocket":
      return "bg-violet-400";
    default:
      return "bg-muted-foreground";
  }
}
function providerPill(code: string): string {
  switch (code) {
    case "bkash":
      return "border-pink-500/30 text-pink-300 bg-pink-500/10";
    case "nagad":
      return "border-orange-500/30 text-orange-300 bg-orange-500/10";
    case "rocket":
      return "border-violet-500/30 text-violet-300 bg-violet-500/10";
    default:
      return "border-border text-muted-foreground";
  }
}
