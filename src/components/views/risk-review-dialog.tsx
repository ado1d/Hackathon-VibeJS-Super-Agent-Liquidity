"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtBDT, providerClasses } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  FileWarning,
} from "lucide-react";
import { Pill } from "@/components/app/primitives";

const VERDICT_OPTIONS = [
  { key: "normal_demand", label: "Likely normal demand", icon: CheckCircle2, tone: "emerald", desc: "Consistent with Eid/festival/payday. False-positive risk HIGH." },
  { key: "needs_verification", label: "Needs field verification", icon: AlertOctagon, tone: "amber", desc: "Unusual but inconclusive. Field officer should verify." },
  { key: "cross_provider", label: "Cross-provider concern", icon: Eye, tone: "violet", desc: "Multi-provider pattern warrants monitoring. Not proof of wrongdoing." },
  { key: "data_quality", label: "Data quality issue", icon: FileWarning, tone: "sky", desc: "Caused by delayed/conflicting feed data. Confidence should stay low." },
  { key: "deeper_review", label: "Requires deeper review", icon: ShieldAlert, tone: "rose", desc: "Concentrated, unexplained pattern. NOT a fraud determination." },
];

const TONES: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-300", icon: "bg-emerald-500/15 text-emerald-300" },
  amber: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-300", icon: "bg-amber-500/15 text-amber-300" },
  violet: { border: "border-violet-500/30", bg: "bg-violet-500/5", text: "text-violet-300", icon: "bg-violet-500/15 text-violet-300" },
  sky: { border: "border-sky-500/30", bg: "bg-sky-500/5", text: "text-sky-300", icon: "bg-sky-500/15 text-sky-300" },
  rose: { border: "border-rose-500/30", bg: "bg-rose-500/5", text: "text-rose-300", icon: "bg-rose-500/15 text-rose-300" },
};

export function RiskReviewDialog({
  caseId: _caseId,
  alert,
  open,
  onOpenChange,
  onSubmit,
}: {
  caseId: string;
  alert: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (note: string) => void;
}) {
  const [selectedVerdict, setSelectedVerdict] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");

  const evidence = (() => {
    if (!alert?.evidence) return null;
    try { return JSON.parse(alert.evidence); } catch { return null; }
  })();

  if (!alert) return null;

  const cls = alert.provider ? providerClasses(alert.provider.code) : providerClasses("cash");
  const facts = evidence?.facts ?? [];
  const possibleReasons = evidence?.possibleNormalReasons ?? [];
  const uncertainty = evidence?.uncertainty;
  const falsePositiveNote = evidence?.falsePositiveNote;
  const sampleTx = evidence?.sampleTx ?? [];
  const TypeIcon = alert.type === "anomaly" ? AlertOctagon : alert.type === "data_quality" ? FileWarning : ShieldAlert;

  function handleSubmit() {
    if (!selectedVerdict) return;
    const verdict = VERDICT_OPTIONS.find((v) => v.key === selectedVerdict);
    const note = `${verdict?.label}: ${verdict?.desc}${customNote.trim() ? `\n\nNotes: ${customNote.trim()}` : ""}`;
    onSubmit(note);
    setSelectedVerdict(null);
    setCustomNote("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto scroll-thin p-0 gap-0">
        <DialogTitle className="sr-only">Risk Review</DialogTitle>

        {/* Header — minimal */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border">
          <div className="grid place-items-center w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Risk Review</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {alert.provider?.name ?? "Cross-provider"} · {alert.agent?.code} · {alert.category}
            </div>
          </div>
        </div>

        {/* Alert context — compact */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-start gap-2">
            <TypeIcon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", cls.text)} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium leading-snug">{alert.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{alert.message}</div>
            </div>
          </div>
        </div>

        {/* Evidence — compact facts only */}
        {(facts.length > 0 || sampleTx.length > 0 || possibleReasons.length > 0 || uncertainty || falsePositiveNote) && (
          <div className="px-5 py-3 border-b border-border space-y-2.5">
            {facts.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {facts.map((f: any, i: number) => (
                  <div key={i} className="flex items-baseline gap-1">
                    <span className="text-[10px] text-muted-foreground">{f.label}:</span>
                    <span className="text-[11px] font-medium tnum">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
            {sampleTx.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sampleTx.slice(0, 3).map((t: any, i: number) => (
                  <span key={i} className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    #{t.id} {fmtBDT(t.amount)} · {t.customer}
                  </span>
                ))}
              </div>
            )}
            {possibleReasons.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                <span className="text-muted-foreground/60">Normal reasons: </span>
                {possibleReasons.join(" · ")}
              </div>
            )}
            {uncertainty && (
              <div className="text-[10px] text-amber-300/70">
                <span className="text-muted-foreground/60">Uncertainty: </span>
                {uncertainty}
              </div>
            )}
            {falsePositiveNote && (
              <div className="text-[10px] text-rose-300/60">
                <span className="text-muted-foreground/60">FP risk: </span>
                {falsePositiveNote}
              </div>
            )}
          </div>
        )}

        {/* Verdict selection — clean cards */}
        <div className="px-5 py-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Verdict</div>
          {VERDICT_OPTIONS.map((v) => {
            const Icon = v.icon;
            const tone = TONES[v.tone];
            const isSel = selectedVerdict === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setSelectedVerdict(v.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all",
                  isSel ? cn(tone.border, tone.bg) : "border-border bg-card/30 hover:bg-card/60"
                )}
              >
                <div className={cn("grid place-items-center w-7 h-7 rounded-md shrink-0", isSel ? tone.icon : "bg-muted/30 text-muted-foreground")}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium leading-tight">{v.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{v.desc}</div>
                </div>
                {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Notes — minimal */}
        <div className="px-5 pb-3">
          <input
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Additional notes (optional)…"
            className="w-full h-9 rounded-md border border-border bg-card/60 px-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* Footer — clean */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
          <div className="text-[10px] text-muted-foreground">
            {selectedVerdict
              ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready to submit</span>
              : <span className="text-amber-400/70 flex items-center gap-1"><Eye className="w-3 h-3" /> Select a verdict to continue</span>
            }
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onOpenChange(false)} className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedVerdict}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                selectedVerdict
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer"
                  : "bg-muted/10 text-muted-foreground/30 border border-border/30 cursor-not-allowed opacity-40"
              )}
            >
              <Eye className="w-3.5 h-3.5" /> Submit
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
