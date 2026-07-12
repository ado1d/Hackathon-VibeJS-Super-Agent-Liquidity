"use client";

import { fmtRel, providerClasses, severityColor } from "@/lib/format";
import { ROLES } from "@/lib/config";
import { SectionTitle, Pill } from "@/components/app/primitives";
import { History, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  events: any[];
}

export function AuditView({ events }: Props) {
  return (
    <div className="space-y-4 fade-up">
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <History className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Coordination Audit Trail</div>
          <div className="text-[11px] text-muted-foreground">
            Every acknowledgement, assignment, escalation, note and resolution is traceable — a hard requirement for responsible operations.
          </div>
        </div>
        <Pill className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
          <ShieldCheck className="w-3 h-3" /> {events.length} events logged
        </Pill>
      </div>

      <div className="surface rounded-xl p-4">
        <SectionTitle title="Event Timeline" desc="Most recent 100 coordination events" />
        <div className="relative pl-6 space-y-3 max-h-[640px] overflow-y-auto scroll-thin pr-1">
          <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
          {events.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No events yet.</div>
          )}
          {events.map((e) => {
            const cls = e.alert?.provider ? providerClasses(e.alert.provider.code) : providerClasses("cash");
            return (
              <div key={e.id} className="relative">
                <span className={cn(
                  "absolute -left-[20px] top-1.5 w-3 h-3 rounded-full border-2 border-background",
                  e.type === "resolved" ? "bg-emerald-400" :
                  e.type === "escalated" ? "bg-rose-400" :
                  e.type === "assigned" ? "bg-violet-400" :
                  e.type === "acknowledged" ? "bg-sky-400" :
                  e.type === "risk_review" ? "bg-amber-400" :
                  e.type === "created" ? "bg-muted-foreground" : "bg-amber-400"
                )} />
                <div className="rounded-lg border border-border bg-card/30 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium capitalize">{e.type === "risk_review" ? "Risk Review" : e.type}</span>
                    <span className="text-[10px] text-muted-foreground">by {e.actor}</span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium",
                      e.role === "agent" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" :
                      e.role === "ops_field" ? "border-sky-500/30 text-sky-300 bg-sky-500/10" :
                      e.role === "ops_area" ? "border-violet-500/30 text-violet-300 bg-violet-500/10" :
                      e.role === "risk" ? "border-amber-500/30 text-amber-300 bg-amber-500/10" :
                      e.role === "management" ? "border-rose-500/30 text-rose-300 bg-rose-500/10" :
                      "border-border text-muted-foreground bg-muted/30"
                    )}>{ROLES.find((r) => r.key === e.role)?.short ?? e.role}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{fmtRel(e.createdAt)}</span>
                  </div>
                  {e.alert && (
                    <div className="text-[11.5px] mt-1 leading-snug">
                      <span className="flex items-center gap-1.5">
                        {e.alert.provider && <span className={cn("w-1.5 h-1.5 rounded-full", cls.dot)} />}
                        <span className="font-medium">{e.alert.title}</span>
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {e.alert.severity && (
                          <span className={cn("text-[9px] px-1 py-0.5 rounded border font-medium", severityColor(e.alert.severity))}>
                            {e.alert.severity}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{e.alert.agent?.code} · {e.alert.agent?.area}</span>
                      </div>
                    </div>
                  )}
                  {e.note && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{e.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
