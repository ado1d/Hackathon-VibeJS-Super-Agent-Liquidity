"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { fmtRel, statusColor, providerClasses, severityColor } from "@/lib/format";
import { SectionTitle, Pill, ConfidenceBadge } from "@/components/app/primitives";
import { RiskReviewDialog } from "@/components/views/risk-review-dialog";
import { api } from "@/lib/api-client";
import { useSaliStore } from "@/lib/store";
import { ROLES, ESCALATION_LADDER } from "@/lib/config";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  ArrowUpCircle,
  StickyNote,
  RotateCcw,
  UserCog,
  Send,
  ShieldCheck,
  Lock,
  ChevronRight,
  Clock,
  Download,
  XCircle,
  Workflow,
  Info,
  Eye,
} from "lucide-react";

interface Props {
  cases: any[];
  onMutate: () => void;
}

const COLUMNS = [
  { key: "open", label: "Open", color: "border-muted-foreground/40" },
  { key: "acknowledged", label: "Acknowledged", color: "border-sky-500/40" },
  { key: "assigned", label: "Assigned", color: "border-violet-500/40" },
  { key: "escalated", label: "Escalated", color: "border-rose-500/40" },
  { key: "resolved", label: "Resolved", color: "border-emerald-500/40" },
] as const;

export function CoordinationView({ cases, onMutate }: Props) {
  const [selected, setSelected] = useState<string | null>(cases[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const role = useSaliStore((s) => s.role);
  const actorName = useSaliStore((s) => s.actorName);
  const roleInfo = ROLES.find((r) => r.key === role)!;
  const [note, setNote] = useState("");
  const [assignRole, setAssignRole] = useState<string>("ops_field");
  const [busy, setBusy] = useState(false);
  const [riskReviewOpen, setRiskReviewOpen] = useState(false);
  const [riskReviewCase, setRiskReviewCase] = useState<any>(null);

  // Apply status filter to cases
  const filteredCases = statusFilter === "all" ? cases : cases.filter((c) => c.status === statusFilter);
  const sel = filteredCases.find((c) => c.id === selected) ?? filteredCases[0] ?? cases.find((c) => c.id === selected) ?? cases[0];

  // Keyboard shortcuts: A=acknowledge, E=escalate, R=resolve
  // Gated by role permissions AND valid status transitions.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT";
      if (isInput) return;
      if (!sel || busy) return;
      const key = e.key.toLowerCase();
      // A = acknowledge (only if open + role allows)
      if (key === "a" && roleInfo.canAcknowledge && sel.status === "open") {
        e.preventDefault();
        act(sel.id, "acknowledged");
      }
      // E = escalate (only if acknowledged/assigned + role allows)
      else if (key === "e" && roleInfo.canEscalate && (sel.status === "acknowledged" || sel.status === "assigned")) {
        e.preventDefault();
        act(sel.id, "escalated");
      }
      // R = resolve (only if acknowledged/assigned/escalated + role allows)
      else if (key === "r" && roleInfo.canResolve && sel.status !== "open" && sel.status !== "resolved") {
        e.preventDefault();
        act(sel.id, "resolved");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sel, busy, roleInfo]);

  async function act(caseId: string, type: string, n?: string) {
    setBusy(true);
    try {
      const agentCode = useSaliStore.getState().loggedInAgentCode;
      await api.caseEvent(caseId, type, actorName, role, n ?? "", agentCode);
      const verb = type === "acknowledged" ? "acknowledged" : type === "escalated" ? "escalated" : type === "resolved" ? "resolved" : type === "assigned" ? "reassigned" : "noted";
      toast.success(`Case ${verb}`, { description: `${actorName} (${roleInfo.short})` });
      setNote("");
      onMutate();
    } catch (e: any) {
      // Handle 403 validation errors from the API
      const msg = e?.message ?? "Action failed";
      toast.error("Action not allowed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function assign(caseId: string) {
    setBusy(true);
    try {
      await api.assignCase(sel.alert.id, assignRole, roleInfo.name, actorName, role);
      toast.success("Case assigned", { description: `Owner set to ${ROLES.find((r) => r.key === assignRole)?.short}` });
      onMutate();
    } catch {
      toast.error("Assign failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 fade-up">
      {/* Workflow guide — shows the status flow + which role can do what */}
      <div className="surface rounded-xl p-4 border-l-2 border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Coordination Workflow</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Status flow + role permissions (enforced server-side)</span>
        </div>

        {/* Status flow diagram */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <FlowNode label="Open" tone="muted" />
          <FlowArrow label="ack" />
          <FlowNode label="Acknowledged" tone="sky" />
          <FlowArrow label="assign" />
          <FlowNode label="Assigned" tone="violet" />
          <FlowArrow label="escalate" />
          <FlowNode label="Escalated" tone="rose" />
          <FlowArrow label="resolve" />
          <FlowNode label="Resolved" tone="emerald" />
          <FlowArrow label="reopen" dashed />
          <FlowNode label="Open" tone="muted" small />
        </div>

        {/* Role permission table */}
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[9px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Role</th>
                <th className="py-1.5 pr-2 font-medium text-center">Ack</th>
                <th className="py-1.5 pr-2 font-medium text-center">Assign</th>
                <th className="py-1.5 pr-2 font-medium text-center">Escalate</th>
                <th className="py-1.5 pr-2 font-medium text-center">Resolve</th>
                <th className="py-1.5 pr-2 font-medium text-center">Reopen</th>
                <th className="py-1.5 font-medium">Scope</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: "Super Agent", perms: [true, false, true, false, true], scope: "Own outlet only", tone: "emerald" },
                { role: "Field Officer", perms: [true, false, true, true, true], scope: "Assigned territory", tone: "sky" },
                { role: "Area Manager", perms: [true, true, true, true, true], scope: "Full area / district", tone: "violet" },
                { role: "Risk Analyst", perms: [true, false, true, false, true], scope: "Network (review only)", tone: "amber" },
                { role: "Management", perms: [false, false, false, false, false], scope: "Read-only (aggregate)", tone: "rose" },
              ].map((r) => (
                <tr key={r.role} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">
                    <span className={cn("inline-flex items-center gap-1.5", `text-${r.tone}-300`)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", `bg-${r.tone}-400`)} />
                      {r.role}{r.role === "Risk Analyst" && <span className="text-[8px] ml-1 text-amber-400/60">+ Risk Review</span>}
                    </span>
                  </td>
                  {r.perms.map((can, i) => (
                    <td key={i} className="py-1.5 pr-2 text-center">
                      {can ? <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" /> : <XCircle className="w-3 h-3 text-muted-foreground/40 inline" />}
                    </td>
                  ))}
                  <td className="py-1.5 text-[10px] text-muted-foreground">{r.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Example walkthrough */}
        <div className="mt-3 pt-3 border-t border-border/60">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground mb-1.5">Example: Scenario A — Hidden Nagad Shortage at AG-KAR-001</div>
          <div className="flex items-start gap-2 text-[10.5px] text-muted-foreground leading-relaxed">
            <Info className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="text-foreground font-medium">Karim (Agent, AG-KAR-001)</span> sees a Nagad shortage alert on his outlet → <span className="text-sky-300">acknowledges</span> it (case: open→acknowledged).
              He can't arrange a refill himself, so he <span className="text-rose-300">escalates</span> to Field Ops (acknowledged→escalated). Agents can only acknowledge and escalate — they cannot resolve.
              <span className="text-foreground font-medium"> Tanvir (Field Officer)</span> is the first responder — he reviews, contacts the outlet, and escalates to Area Manager for authorised support. He can resolve if he fixes it at the outlet level, but can't assign cases to others.
              <span className="text-foreground font-medium"> Nadia (Area Manager)</span> is the senior coordinator — she <span className="text-violet-300">assigns</span> cases to field officers, approves an authorised provider refill, and <span className="text-emerald-300">resolves</span> the case (escalated→resolved) with a closing note.
              <span className="text-amber-300 font-medium"> Sadia (Risk Analyst)</span> reviewed the anomaly evidence but did NOT resolve it — she only reviews and escalates. Management saw the aggregate KPI but could not act on the individual case.
            </div>
          </div>
        </div>
      </div>

      {/* Board summary + filter pills — click to filter the case list */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2",
            statusFilter === "all" ? "bg-primary/15 text-primary border-primary/30" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
          )}
        >
          All <span className="font-bold tnum">{cases.length}</span>
        </button>
        {COLUMNS.map((col) => {
          const items = cases.filter((c) => c.status === col.key);
          const active = statusFilter === col.key;
          return (
            <button
              key={col.key}
              onClick={() => { setStatusFilter(active ? "all" : col.key); setSelected(items[0]?.id ?? null); }}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium border-l-2 transition-colors flex items-center gap-2",
                active ? cn("bg-card/60", col.color, "text-foreground") : cn("bg-muted/30", col.color, "text-muted-foreground hover:text-foreground")
              )}
            >
              {col.label} <span className="font-bold tnum">{items.length}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Case list */}
        <div className="lg:col-span-2 surface rounded-xl p-3 max-h-[640px] overflow-y-auto scroll-thin">
          <SectionTitle title="Cases" desc={`${filteredCases.length} of ${cases.length} shown`} />
          <div className="space-y-2">
            {filteredCases.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No cases match this filter.</div>}
            {filteredCases.map((c) => {
              const cls = c.alert.provider ? providerClasses(c.alert.provider.code) : providerClasses("cash");
              const active = sel?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-colors",
                    active ? "bg-primary/10 border-primary/40" : "bg-card/40 border-border hover:bg-card/70"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityColor(c.alert.severity))}>
                      {c.alert.severity}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(c.status))}>
                      {c.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{c.priority.toUpperCase()}</span>
                    {c.alert.scenarioTag && <Pill className="border-primary/30 text-primary bg-primary/10 text-[9px]">{c.alert.scenarioTag}</Pill>}
                    {c.alert.provider && <span className={cn("text-[10px] font-medium", cls.text)}>{c.alert.provider.name}</span>}
                  </div>
                  <div className="text-xs font-medium leading-snug line-clamp-2">{c.alert.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span>{c.alert.agent.code} · {c.alert.agent.area}</span>
                    <span>·</span>
                    <span>{fmtRel(c.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Case detail */}
        <div className="lg:col-span-3">
          {sel ? (
            <CaseDetail
              c={sel}
              role={role}
              roleInfo={roleInfo}
              actorName={actorName}
              note={note}
              setNote={setNote}
              assignRole={assignRole}
              setAssignRole={setAssignRole}
              busy={busy}
              onAct={act}
              onAssign={assign}
              onRiskReview={(c: any) => { setRiskReviewCase(c); setRiskReviewOpen(true); }}
            />
          ) : (
            <div className="surface rounded-xl p-8 text-center text-muted-foreground text-sm h-full grid place-items-center">
              Select a case to view coordination detail.
            </div>
          )}
        </div>
      </div>

      {/* Risk Review dialog — rendered at the parent level */}
      {riskReviewCase && (
        <RiskReviewDialog
          caseId={riskReviewCase.id}
          alert={riskReviewCase.alert}
          open={riskReviewOpen}
          onOpenChange={(v) => { if (!v) setRiskReviewCase(null); setRiskReviewOpen(v); }}
          onSubmit={(note) => { act(riskReviewCase.id, "risk_review", note); }}
        />
      )}
    </div>
  );
}

function CaseDetail({
  c,
  role,
  roleInfo,
  actorName,
  note,
  setNote,
  assignRole,
  setAssignRole,
  busy,
  onAct,
  onAssign,
  onRiskReview,
}: any) {
  const cls = c.alert.provider ? providerClasses(c.alert.provider.code) : providerClasses("cash");
  const escalation = (() => {
    try { return JSON.parse(c.escalationPath ?? "[]"); } catch { return []; }
  })();

  return (
    <div className="surface rounded-xl p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", severityColor(c.alert.severity))}>
            {c.alert.severity}
          </span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor(c.status))}>
            {c.status}
          </span>
          <span className="text-[10px] text-muted-foreground">{c.priority.toUpperCase()}</span>
          {c.alert.scenarioTag && <Pill className="border-primary/30 text-primary bg-primary/10">Scenario {c.alert.scenarioTag}</Pill>}
          {c.alert.provider && <span className={cn("text-[11px] font-medium", cls.text)}>{c.alert.provider.name}</span>}
          <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" /> {fmtRel(c.createdAt)}
          </span>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{c.alert.title}</h3>
        <div className="text-[11px] text-muted-foreground mt-1">
          {c.alert.agent.code} · {c.alert.agent.name} · {c.alert.agent.area}
        </div>
      </div>

      {/* Ownership + escalation path */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <UserCog className="w-3 h-3" /> Ownership
          </div>
          <div className="text-sm font-medium">{c.ownerName ?? "Unassigned"}</div>
          <div className="text-[11px] text-muted-foreground">
            {ROLES.find((r) => r.key === c.ownerRole)?.name ?? c.ownerRole}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <ArrowUpCircle className="w-3 h-3" /> Escalation path
          </div>
          <div className="flex items-center flex-wrap gap-1">
            {escalation.length > 0 ? escalation.map((r: string, i: number) => (
              <span key={r} className="flex items-center gap-1">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", r === c.ownerRole ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground")}>
                  {ROLES.find((rr) => rr.key === r)?.short ?? r}
                </span>
                {i < escalation.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
              </span>
            )) : <span className="text-[11px] text-muted-foreground">—</span>}
          </div>
        </div>
      </div>

      {/* Audit trail */}
      <div>
        <SectionTitle
          title="Audit Trail"
          desc="Every action is traceable — acknowledgement, escalation, notes, resolution."
          right={
            <a
              href={`/api/cases/${c.id}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
              onClick={() => toast.success("Exporting case study", { description: "Markdown case study downloaded." })}
            >
              <Download className="w-3 h-3" /> Export case study
            </a>
          }
        />
        <div className="relative pl-5 space-y-3 max-h-[260px] overflow-y-auto scroll-thin pr-1">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
          {c.events.map((e: any) => {
            const roleInfo = ROLES.find((r) => r.key === e.role);
            const roleShort = roleInfo?.short ?? e.role;
            const roleTone: Record<string, string> = {
              agent: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10",
              ops_field: "border-sky-500/30 text-sky-300 bg-sky-500/10",
              ops_area: "border-violet-500/30 text-violet-300 bg-violet-500/10",
              risk: "border-amber-500/30 text-amber-300 bg-amber-500/10",
              management: "border-rose-500/30 text-rose-300 bg-rose-500/10",
              system: "border-border text-muted-foreground bg-muted/30",
            };
            return (
            <div key={e.id} className="relative">
              <span className={cn(
                "absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-background",
                e.type === "resolved" ? "bg-emerald-400" :
                e.type === "escalated" ? "bg-rose-400" :
                e.type === "assigned" ? "bg-violet-400" :
                e.type === "acknowledged" ? "bg-sky-400" :
                e.type === "risk_review" ? "bg-amber-400" :
                e.type === "created" ? "bg-muted-foreground" : "bg-amber-400"
              )} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium capitalize">{e.type === "risk_review" ? "Risk Review" : e.type}</span>
                <span className="text-[10px] text-muted-foreground">by {e.actor}</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium", roleTone[e.role] ?? roleTone.system)}>{roleShort}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{fmtRel(e.createdAt)}</span>
              </div>
              {e.note && <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{e.note}</p>}
            </div>
            );
          })}
        </div>
      </div>

      {/* Actions (role-gated) */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span className="font-medium">Coordination actions</span>
          <span className="text-muted-foreground">— acting as {roleInfo.short} ({actorName})</span>
          <Pill className="ml-auto border-border text-muted-foreground">never auto-moves funds</Pill>
        </div>

        {/* Assign row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Reassign to:</span>
          <select
            value={assignRole}
            onChange={(e) => setAssignRole(e.target.value)}
            className="h-7 rounded-md border border-border bg-card/60 px-2 text-xs"
          >
            {ESCALATION_LADDER.map((r) => (
              <option key={r.role} value={r.role}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={() => onAssign(c.id)}
            disabled={busy || !roleInfo.canAssign}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition-colors flex items-center gap-1 disabled:opacity-40"
          >
            {!roleInfo.canAssign && <Lock className="w-3 h-3" />}
            <UserCog className="w-3 h-3" /> Assign
          </button>
        </div>

        {/* Action buttons — disabled based on valid status transitions + role permissions */}
        <div className="flex items-center gap-2 flex-wrap">
          <ActionBtn
            onClick={() => onAct(c.id, "acknowledged")}
            disabled={busy || !roleInfo.canAcknowledge || c.status !== "open"}
            icon={CheckCircle2}
            label="Acknowledge"
            tone="sky"
            locked={!roleInfo.canAcknowledge}
            shortcut="A"
          />
          <ActionBtn
            onClick={() => onAct(c.id, "escalated")}
            disabled={busy || !roleInfo.canEscalate || (c.status !== "acknowledged" && c.status !== "assigned")}
            icon={ArrowUpCircle}
            label="Escalate"
            tone="rose"
            locked={!roleInfo.canEscalate}
            shortcut="E"
          />
          <ActionBtn
            onClick={() => onAct(c.id, "resolved")}
            disabled={busy || !roleInfo.canResolve || c.status === "open" || c.status === "resolved"}
            icon={CheckCircle2}
            label="Resolve"
            tone="emerald"
            locked={!roleInfo.canResolve}
            shortcut="R"
          />
          <ActionBtn
            onClick={() => onAct(c.id, "reopened")}
            disabled={busy || c.status !== "resolved" || !roleInfo.canAcknowledge}
            icon={RotateCcw}
            label="Reopen"
            tone="amber"
            locked={!roleInfo.canAcknowledge}
          />
          {/* Risk Review — exclusive to Risk Analyst role */}
          {role === "risk" && (
            <ActionBtn
              onClick={() => onRiskReview(c)}
              disabled={busy}
              icon={Eye}
              label="Risk Review"
              tone="amber"
              locked={false}
            />
          )}
        </div>

        {/* Status transition hint */}
        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          {c.status === "open" && "Must acknowledge before escalating or resolving."}
          {c.status === "acknowledged" && "Can assign, escalate, or resolve."}
          {c.status === "assigned" && "Can escalate or resolve."}
          {c.status === "escalated" && "Can only resolve or add notes."}
          {c.status === "resolved" && "Case is closed. Can reopen if needed."}
        </div>

        {/* Note */}
        <div className="flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a coordination note (visible in audit trail)…"
            className="flex-1 h-8 rounded-md border border-border bg-card/60 px-2.5 text-xs"
          />
          <button
            onClick={() => note.trim() && onAct(c.id, "note", note.trim())}
            disabled={busy || !note.trim()}
            className="px-2.5 h-8 rounded-md text-[11px] font-medium bg-muted/60 border border-border hover:bg-muted transition-colors flex items-center gap-1 disabled:opacity-40"
          >
            <Send className="w-3 h-3" /> Note
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon: Icon, label, tone, locked, shortcut }: any) {
  const tones: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-40", tones[tone])}
    >
      {locked && <Lock className="w-3 h-3" />}
      <Icon className="w-3.5 h-3.5" /> {label}
      {shortcut && !disabled && !locked && (
        <kbd className="ml-0.5 text-[8px] border border-current/30 rounded px-0.5 py-px opacity-60">{shortcut}</kbd>
      )}
    </button>
  );
}

// --- Workflow guide helper components ---
function FlowNode({ label, tone, small }: { label: string; tone: string; small?: boolean }) {
  const tones: Record<string, string> = {
    muted: "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md border font-medium whitespace-nowrap",
      small ? "text-[9px]" : "text-[10px]",
      tones[tone] ?? tones.muted
    )}>
      {label}
    </span>
  );
}

function FlowArrow({ label, dashed }: { label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground shrink-0">
      <span className={cn("text-[8px] uppercase tracking-wider", dashed && "opacity-50")}>{label}</span>
      <svg width="16" height="8" viewBox="0 0 16 8" className="shrink-0">
        <line x1="0" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray={dashed ? "2 2" : undefined} opacity="0.5" />
        <path d="M12 1 L15 4 L12 7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
    </span>
  );
}
