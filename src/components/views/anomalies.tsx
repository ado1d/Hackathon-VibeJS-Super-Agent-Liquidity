"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtRel, severityColor, statusColor, providerClasses, fmtBDT } from "@/lib/format";
import { SectionTitle, ConfidenceBadge, Pill } from "@/components/app/primitives";
import { api } from "@/lib/api-client";
import { useSaliStore } from "@/lib/store";
import { ROLES } from "@/lib/config";
import { toast } from "sonner";
import {
  ScanSearch,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  FileWarning,
  AlertOctagon,
  CheckCircle2,
  Languages,
  Loader2,
  CircleDot,
  Quote,
  Pin,
  PinOff,
} from "lucide-react";

interface Props {
  alerts: any[];
  onMutate: () => void;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "anomaly", label: "Anomaly" },
  { key: "data_quality", label: "Data Quality" },
  { key: "liquidity", label: "Liquidity" },
] as const;

export function AnomalyView({ alerts, onMutate }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const role = useSaliStore((s) => s.role);
  const actorName = useSaliStore((s) => s.actorName);
  const pinnedAlerts = useSaliStore((s) => s.pinnedAlerts);
  const togglePin = useSaliStore((s) => s.togglePin);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, { bn: any; en: any }>>({});
  const [lang, setLang] = useState<"bn" | "en">("bn");

  const filtered = alerts.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (pinnedOnly && !pinnedAlerts.includes(a.id)) return false;
    return true;
  });
  const open = filtered.filter((a) => a.status !== "resolved");
  const resolved = filtered.filter((a) => a.status === "resolved");

  async function getExplanation(alertId: string) {
    setExplaining(alertId);
    try {
      const [bn, en] = await Promise.all([
        api.aiExplain(alertId, "bn"),
        api.aiExplain(alertId, "en"),
      ]);
      setExplanations((p) => ({ ...p, [alertId]: { bn: bn.explanation, en: en.explanation } }));
      toast.success("AI advisory generated", { description: "Careful language, safe next step included." });
    } catch (e) {
      toast.error("AI explanation failed", { description: "Showing safe fallback template instead." });
    } finally {
      setExplaining(null);
    }
  }

  async function ack(alertId: string) {
    try {
      const agentCode = useSaliStore.getState().loggedInAgentCode;
      await api.ackAlert(alertId, actorName, role, agentCode);
      toast.success("Alert acknowledged", { description: `${actorName} (${ROLES.find((r) => r.key === role)?.short})` });
      onMutate();
    } catch (e: any) {
      toast.error("Cannot acknowledge", { description: e?.message ?? "Action failed" });
    }
  }

  return (
    <div className="space-y-5 fade-up">
      {/* Filter bar */}
      <div className="surface rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
          <ScanSearch className="w-4 h-4" /> {open.length} open · {resolved.length} resolved
        </div>
        <button
          onClick={() => setPinnedOnly((v) => !v)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border flex items-center gap-1",
            pinnedOnly
              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
              : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
          )}
          title="Show only pinned alerts"
        >
          <Pin className="w-3 h-3" /> Pinned {pinnedAlerts.length > 0 && `(${pinnedAlerts.length})`}
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                filter === f.key
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <div className="surface rounded-xl p-8 text-center text-muted-foreground text-sm">
            No signals in this category. The network looks clean.
          </div>
        )}
        {filtered.map((a) => {
          const isOpen = expanded === a.id;
          const cls = a.provider ? providerClasses(a.provider.code) : providerClasses("cash");
          const exp = explanations[a.id];
          const TypeIcon = a.type === "anomaly" ? AlertOctagon : a.type === "data_quality" ? FileWarning : ShieldAlert;
          return (
            <div key={a.id} className={cn("surface rounded-xl overflow-hidden border-l-2", cls.border)} style={{ borderLeftColor: a.provider?.brandColor ?? "#34d399" }}>
              <div
                onClick={() => setExpanded(isOpen ? null : a.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isOpen ? null : a.id); } }}
                className="w-full text-left p-4 flex items-start gap-3 cursor-pointer"
              >
                <TypeIcon className={cn("w-4 h-4 mt-0.5 shrink-0", cls.text)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityColor(a.severity))}>
                      {a.severity}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase tracking-wide">
                      {a.category.replace(/_/g, " ")}
                    </span>
                    {a.provider && <span className={cn("text-[11px] font-medium", cls.text)}>{a.provider.name}</span>}
                    {a.scenarioTag && <Pill className="border-primary/30 text-primary bg-primary/10">Scenario {a.scenarioTag}</Pill>}
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium ml-auto", statusColor(a.status))}>
                      {a.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium mt-1.5 leading-snug">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{a.agent.code} · {a.agent.area}</span>
                    <span>·</span>
                    <span>{fmtRel(a.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <ConfidenceBadge label={a.confidenceLabel} value={a.confidence} />
                    {!a.messageBn && a.type !== "data_quality" && (
                      <span className="text-[10px] text-muted-foreground">advisory only · not fraud</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(a.id); toast.success(pinnedAlerts.includes(a.id) ? "Unpinned" : "Pinned", { duration: 1500 }); }}
                  className={cn(
                    "grid place-items-center w-7 h-7 rounded-md border transition-colors shrink-0 mt-0.5",
                    pinnedAlerts.includes(a.id)
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  )}
                  title={pinnedAlerts.includes(a.id) ? "Unpin alert" : "Pin alert for quick access"}
                >
                  {pinnedAlerts.includes(a.id) ? <Pin className="w-3.5 h-3.5 fill-current" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform mt-1", isOpen && "rotate-180")} />
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-4">
                  {/* Evidence */}
                  <EvidencePanel alert={a} />

                  {/* AI explainer */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="w-4 h-4 text-violet-300" />
                        AI Advisory {a.type === "anomaly" ? "(requires review)" : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border border-border overflow-hidden">
                          <button
                            onClick={() => setLang("bn")}
                            className={cn("px-2 py-1 text-[11px] font-medium flex items-center gap-1", lang === "bn" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
                          >
                            <Languages className="w-3 h-3" /> বাংলা
                          </button>
                          <button
                            onClick={() => setLang("en")}
                            className={cn("px-2 py-1 text-[11px] font-medium", lang === "en" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
                          >
                            EN
                          </button>
                        </div>
                        <button
                          onClick={() => getExplanation(a.id)}
                          disabled={explaining === a.id}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {explaining === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {exp ? "Regenerate" : "Explain"}
                        </button>
                      </div>
                    </div>

                    {exp ? (
                      <AdvisoryCard exp={lang === "bn" ? exp.bn : exp.en} lang={lang} />
                    ) : (
                      <div className="text-[12px] text-muted-foreground">
                        {a.messageBn && lang === "bn" ? (
                          <div className="bn rounded-md border border-border bg-card/40 p-2.5 leading-relaxed">{a.messageBn}</div>
                        ) : (
                          <div className="rounded-md border border-border bg-card/40 p-2.5 leading-relaxed">{a.message}</div>
                        )}
                        <div className="mt-1.5 text-[10px]">Click <span className="text-primary font-medium">Explain</span> to generate a structured situation / evidence / uncertainty / safe-next-step advisory.</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {a.status === "open" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => ack(a.id)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge as {ROLES.find((r) => r.key === role)?.short}
                      </button>
                      <span className="text-[11px] text-muted-foreground">Opens a coordination case routed to {a.type === "anomaly" ? "Risk" : "Field Ops"}.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidencePanel({ alert }: { alert: any }) {
  let evidence: any = {};
  try {
    evidence = JSON.parse(alert.evidence);
  } catch {
    /* ignore */
  }
  const facts: { label: string; value: string }[] = evidence.facts ?? [];
  const sampleTx: any[] = evidence.sampleTx ?? [];
  const normalReasons: string[] = evidence.possibleNormalReasons ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-card/30 p-3">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CircleDot className="w-3 h-3" /> Evidence
        </div>
        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {facts.map((f, i) => (
              <div key={i} className="flex flex-col">
                <dt className="text-[10px] text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium tnum">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No structured facts.</p>
        )}
        {sampleTx.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-muted-foreground mb-1">Sample transactions</div>
            <div className="space-y-1">
              {sampleTx.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] tnum">
                  <span className="text-muted-foreground">#{t.id}</span>
                  <span className="font-medium">{fmtBDT(t.amount)} BDT</span>
                  <span className="text-muted-foreground">{t.customer}</span>
                  <span className="text-muted-foreground ml-auto">{t.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-3 space-y-3">
        {normalReasons.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Possible normal reasons</div>
            <ul className="space-y-1">
              {normalReasons.map((r, i) => (
                <li key={i} className="text-[11.5px] text-muted-foreground flex gap-1.5">
                  <span className="text-emerald-400/70">•</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {evidence.uncertainty && (
          <div>
            <div className="text-[11px] font-semibold text-amber-300/80 uppercase tracking-wider mb-1">Uncertainty</div>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">{evidence.uncertainty}</p>
          </div>
        )}
        {evidence.safeNextStep && (
          <div>
            <div className="text-[11px] font-semibold text-emerald-300/80 uppercase tracking-wider mb-1">Safe next step</div>
            <p className="text-[11.5px] text-foreground/90 leading-relaxed">{evidence.safeNextStep}</p>
          </div>
        )}
        {evidence.falsePositiveNote && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
            <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> False-positive note
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{evidence.falsePositiveNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvisoryCard({ exp, lang }: { exp: any; lang: "bn" | "en" }) {
  const rows = [
    { k: "situation", label: "Situation", tone: "text-foreground" },
    { k: "evidence", label: "Evidence", tone: "text-muted-foreground" },
    { k: "uncertainty", label: "Uncertainty", tone: "text-amber-300" },
    { k: "safeNextStep", label: "Safe next step", tone: "text-emerald-300" },
  ];
  return (
    <div className={cn("rounded-md border border-violet-500/20 bg-violet-500/5 p-3 space-y-2", lang === "bn" && "bn")}>
      {rows.map((r) => (
        <div key={r.k}>
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1", r.tone)}>
            <Quote className="w-2.5 h-2.5 opacity-60" /> {r.label}
          </div>
          <p className="text-[12px] leading-relaxed text-foreground/90">{exp[r.k]}</p>
        </div>
      ))}
    </div>
  );
}
