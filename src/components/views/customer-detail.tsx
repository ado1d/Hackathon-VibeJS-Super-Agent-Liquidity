"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fmtBDT, fmtRel, providerClasses } from "@/lib/format";
import { Pill } from "@/components/app/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Loader2,
  ShieldCheck,
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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

export function CustomerDetailDialog({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !open) return;
    let active = true;
    const load = async () => {
      try {
        const r = await api.customer(customerId);
        if (active) { setData(r); setLoadingKey(null); }
      } catch {
        if (active) { setData(null); setLoadingKey(null); }
      }
    };
    // setLoadingKey triggers a re-render to show the spinner while loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingKey(customerId);
    load();
    return () => { active = false; };
  }, [customerId, open]);

  const loading = loadingKey === customerId && !data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <User className="w-4 h-4 text-violet-300" />
            {customerId ?? "Customer"}
            {data?.anomalyCount > 0 && (
              <Pill className="border-amber-500/30 text-amber-300 bg-amber-500/10 text-[9px]">
                <AlertOctagon className="w-2.5 h-2.5" /> {data.anomalyCount} flagged
              </Pill>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="grid place-items-center h-40 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin mb-2" />
            Loading customer history…
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Mini label="Transactions" value={data.totalTransactions} />
              <Mini label="Total Value" value={fmtBDT(data.totalValue)} unit="BDT" />
              <Mini label="Providers" value={data.providers.length} />
              <Mini label="Agents" value={data.agents.length} />
            </div>

            {/* Providers breakdown */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Providers</div>
              <div className="flex flex-wrap gap-1.5">
                {data.providers.map((p: any) => {
                  const cls = providerClasses(p.code);
                  return (
                    <div key={p.code} className={cn("rounded-md border p-2 flex items-center gap-2", cls.border, cls.bg)}>
                      <span className={cn("w-2 h-2 rounded-full", cls.dot)} />
                      <span className={cn("text-[11px] font-medium", cls.text)}>{p.name}</span>
                      <span className="text-[10px] text-muted-foreground tnum">{p.count} txns</span>
                      <span className="text-[10px] text-muted-foreground tnum">· {fmtBDT(p.value)} BDT</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agents breakdown */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Agents visited</div>
              <div className="flex flex-wrap gap-1.5">
                {data.agents.map((a: any) => (
                  <Pill key={a.code} className="border-border text-muted-foreground text-[10px]">
                    {a.code} · {a.area} ({a.count})
                  </Pill>
                ))}
              </div>
            </div>

            {/* Transaction history */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Transaction history ({data.transactions.length})
              </div>
              <div className="max-h-[280px] overflow-y-auto scroll-thin rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="py-1.5 px-2 font-medium">Type</th>
                      <th className="py-1.5 px-2 font-medium">Provider</th>
                      <th className="py-1.5 px-2 font-medium text-right">Amount</th>
                      <th className="py-1.5 px-2 font-medium">Agent</th>
                      <th className="py-1.5 px-2 font-medium">Status</th>
                      <th className="py-1.5 px-2 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any) => {
                      const cls = providerClasses(t.provider.code);
                      const Icon = typeIcons[t.type] ?? ArrowDownLeft;
                      return (
                        <tr key={t.id} className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20", t.isAnomaly && "bg-amber-500/5")}>
                          <td className="py-1.5 px-2">
                            <span className="flex items-center gap-1">
                              <Icon className={cn("w-3 h-3", typeColors[t.type] ?? "text-muted-foreground")} />
                              <span className="text-[10px] capitalize">{t.type.replace(/_/g, " ")}</span>
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={cn("inline-flex items-center gap-1 text-[10px]", cls.text)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", cls.dot)} />
                              {t.provider.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right tnum text-[11px] font-medium">{fmtBDT(t.amount)}</td>
                          <td className="py-1.5 px-2 text-[10px] text-muted-foreground">{t.agent.code}</td>
                          <td className="py-1.5 px-2">
                            {t.status === "success" ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-400" />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right text-[10px] text-muted-foreground tnum">{fmtRel(t.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Privacy note */}
            <div className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground leading-relaxed rounded-md border border-border bg-muted/20 p-2.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              {data.note}
            </div>
          </div>
        )}

        {!loading && !data && (
          <div className="text-center text-muted-foreground text-sm py-8">No data found for this customer.</div>
        )}
      </DialogContent>
    </Dialog>
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
