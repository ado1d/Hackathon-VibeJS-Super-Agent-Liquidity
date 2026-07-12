"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtRel, providerClasses } from "@/lib/format";
import { PROVIDERS } from "@/lib/config";
import { SectionTitle, Pill, AnimatedNumber } from "@/components/app/primitives";
import {
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Search,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  ShieldCheck,
} from "lucide-react";
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

interface Txn {
  id: string;
  type: string;
  amount: number;
  customerId: string;
  status: string;
  isAnomaly: boolean;
  anomalyTags: string | null;
  provider: { code: string; name: string; brandColor: string };
  timestamp: string;
}

export function TransactionsView({
  agents,
  activeAgentId,
}: {
  agents: any[];
  activeAgentId: string | null;
}) {
  const agentId = activeAgentId ?? agents[0]?.id;
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(80);

  async function load() {
    if (!agentId) return;
    setLoading(true);
    try {
      const r = await api.transactions(agentId, providerFilter, anomalyOnly);
      setTxns(r.transactions);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [agentId, providerFilter, anomalyOnly]);

  // client-side filters for type + search (server already filters provider+anomaly)
  const filtered = useMemo(() => {
    let list = txns;
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.customerId.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          String(t.amount).includes(q)
      );
    }
    return list.slice(0, limit);
  }, [txns, typeFilter, search, limit]);

  // stats
  const stats = useMemo(() => {
    const total = txns.length;
    const anomalies = txns.filter((t) => t.isAnomaly).length;
    const success = txns.filter((t) => t.status === "success").length;
    const failed = txns.filter((t) => t.status === "failed").length;
    const totalValue = txns.filter((t) => t.status === "success").reduce((s, t) => s + t.amount, 0);
    const byProvider = (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((code) => ({
      code,
      name: PROVIDERS[code].name,
      color: PROVIDERS[code].brandColor,
      count: txns.filter((t) => t.provider.code === code).length,
      value: txns.filter((t) => t.provider.code === code && t.status === "success").reduce((s, t) => s + t.amount, 0),
    }));
    return { total, anomalies, success, failed, totalValue, byProvider };
  }, [txns]);

  const typeIcons: Record<string, React.ElementType> = {
    cashin: ArrowDownLeft,
    cashout: ArrowUpRight,
    transfer_in: ArrowDownLeft,
    transfer_out: ArrowUpRight,
  };
  const typeColors: Record<string, string> = {
    cashin: "text-emerald-300",
    cashout: "text-rose-300",
    transfer_in: "text-sky-300",
    transfer_out: "text-amber-300",
  };

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <Receipt className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Transaction Explorer</div>
          <div className="text-[11px] text-muted-foreground">
            Raw synthetic transactions with anomaly tags. Filter by provider, type, or search by customer/amount. All data is simulated.
          </div>
        </div>
        <Pill className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
          <ShieldCheck className="w-3 h-3" /> synthetic only
        </Pill>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StatCard label="Total" value={<AnimatedNumber value={stats.total} />} icon={Receipt} tone="sky" />
        <StatCard label="Success" value={<AnimatedNumber value={stats.success} />} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Failed" value={<AnimatedNumber value={stats.failed} />} icon={XCircle} tone="rose" />
        <StatCard label="Flagged" value={<AnimatedNumber value={stats.anomalies} />} icon={AlertOctagon} tone="amber" />
        <StatCard label="Volume" value={<AnimatedNumber value={stats.totalValue} format={(n) => fmtBDT(n)} />} unit="BDT" icon={ArrowDownLeft} tone="violet" />
      </div>

      {/* Provider breakdown chart */}
      <div className="surface rounded-xl p-4">
        <SectionTitle title="Volume by Provider" desc="Transaction count & value per provider — boundaries kept separate." />
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byProvider} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
              <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 11 }} />
              <YAxis stroke="currentColor" className="text-muted-foreground" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => name === "value" ? [`${fmtBDT(v)} BDT`, "Value"] : [v, "Count"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="value">
                {stats.byProvider.map((p, i) => (
                  <Cell key={i} fill={p.color} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="surface rounded-xl p-3 flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {/* Provider filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setProviderFilter("all")}
            className={cn("px-2 py-1 rounded-md text-[11px] font-medium border transition-colors", providerFilter === "all" ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground")}
          >
            All
          </button>
          {(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((code) => {
            const cls = providerClasses(code);
            return (
              <button
                key={code}
                onClick={() => setProviderFilter(code)}
                className={cn("px-2 py-1 rounded-md text-[11px] font-medium border transition-colors", providerFilter === code ? cn(cls.bg, cls.border, cls.text) : "border-border text-muted-foreground hover:text-foreground")}
              >
                {PROVIDERS[code].name}
              </button>
            );
          })}
        </div>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-7 rounded-md border border-border bg-card/60 px-2 text-[11px]"
        >
          <option value="all">All types</option>
          <option value="cashin">Cash In</option>
          <option value="cashout">Cash Out</option>
          <option value="transfer_in">Transfer In</option>
          <option value="transfer_out">Transfer Out</option>
        </select>
        {/* Anomaly toggle */}
        <button
          onClick={() => setAnomalyOnly((v) => !v)}
          className={cn("px-2 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1", anomalyOnly ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "border-border text-muted-foreground hover:text-foreground")}
        >
          <AlertOctagon className="w-3 h-3" /> Flagged only
        </button>
        {/* Search */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer / amount…"
              className="h-7 w-40 rounded-md border border-border bg-card/60 pl-7 pr-2 text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div className="surface rounded-xl p-4">
        <SectionTitle
          title="Transaction Log"
          desc={`${filtered.length} of ${txns.length} transactions shown`}
          right={
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-7 rounded-md border border-border bg-card/60 px-2 text-[11px]"
              >
                <option value={40}>Last 40</option>
                <option value={80}>Last 80</option>
                <option value={150}>Last 150</option>
              </select>
            </div>
          }
        />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium text-right">Amount</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Flags</th>
                <th className="py-2 pr-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    {loading ? "Loading…" : "No transactions match these filters."}
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const cls = providerClasses(t.provider.code);
                const Icon = typeIcons[t.type] ?? Receipt;
                return (
                  <tr key={t.id} className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors", t.isAnomaly && "bg-amber-500/5")}>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <Icon className={cn("w-3.5 h-3.5", typeColors[t.type] ?? "text-muted-foreground")} />
                        <span className="text-[11px] font-medium capitalize">{t.type.replace(/_/g, " ")}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", cls.text)}>
                        <span className={cn("w-2 h-2 rounded-full", cls.dot)} />
                        {t.provider.name}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tnum font-medium">{fmtBDT(t.amount)}</td>
                    <td className="py-2 pr-3 text-[11px] text-muted-foreground font-mono">{t.customerId}</td>
                    <td className="py-2 pr-3">
                      {t.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="w-3 h-3" /> success</span>
                      ) : t.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-300"><XCircle className="w-3 h-3" /> failed</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-300"><Clock className="w-3 h-3" /> pending</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {t.isAnomaly ? (
                        <Pill className="border-amber-500/30 text-amber-300 bg-amber-500/10 text-[9px]">
                          <AlertOctagon className="w-2.5 h-2.5" /> {t.anomalyTags?.split(",")[0] ?? "flagged"}
                        </Pill>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-[10px] text-muted-foreground tnum">{fmtRel(t.timestamp)}</td>
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

function StatCard({ label, value, unit, icon: Icon, tone }: { label: string; value: React.ReactNode; unit?: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    sky: "text-sky-300",
    violet: "text-violet-300",
  };
  return (
    <div className="surface rounded-lg p-3 flex items-center gap-2.5">
      <Icon className={cn("w-4 h-4", tones[tone])} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-lg font-bold tnum", tones[tone])}>{value}</span>
          {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
