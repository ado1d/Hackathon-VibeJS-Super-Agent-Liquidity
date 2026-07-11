import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Copy,
  ClipboardCheck,
  Printer,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { post, api } from "../api";
import { useAuth } from "../auth";
import { CaseNoteForm } from "../components/CaseNoteForm";
import { EvidencePanel } from "../components/EvidencePanel";
import { StatusBadge } from "../components/StatusBadge";
import { Timeline } from "../components/Timeline";
import { WorkflowActionBar } from "../components/WorkflowActionBar";
import { labels, type Language } from "../i18n/templates";
import type { AIResponse, AIStatus, Alert } from "../types";
import { toast } from "sonner";

interface AlertEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
}

interface Detail {
  alert: Alert;
  notes: {
    id: string;
    content: string;
    note_type: string;
    created_at: string;
  }[];
  events: AlertEvent[];
  explanation_complete: boolean;
}

export function AlertDetail() {
  const { alertId = "" } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [language, setLanguage] = useState<Language>("en");
  const [aiResult, setAIResult] = useState<AIResponse | null>(null);

  const detail = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => api<Detail>(`/alerts/${alertId}`),
  });
  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<AIStatus>("/ai/status"),
  });
  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) =>
      post(`/alerts/${alertId}/${name}`, body),
    onSuccess: () => {
      toast.success("Workflow updated and audited");
      void client.invalidateQueries({ queryKey: ["alert", alertId] });
    },
    onError: (error) => toast.error(error.message),
  });
  const aiAction = useMutation({
    mutationFn: (feature: "translate" | "summarize" | "recommendations") => {
      const suffix =
        feature === "translate"
          ? `/translate?lang=${language === "bn" ? "bn" : "banglish"}`
          : `/${feature}`;
      return post<AIResponse>(`/alerts/${alertId}${suffix}`);
    },
    onSuccess: (result) => {
      setAIResult(result);
      toast.success("AI assistance ready for human review");
    },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isLoading) {
    return <div className="loading">Loading evidence and audit timeline…</div>;
  }
  if (!detail.data) {
    return <div className="error-state">{detail.error?.message}</div>;
  }

  const alert = detail.data.alert;
  const t = labels[language];
  const handover = [
    `Alert: ${alert.summary}`,
    `Severity / status: ${alert.severity} / ${alert.status}`,
    `Why flagged: ${alert.reason}`,
    `Confidence: ${Math.round(Number(alert.confidence) * 100)}%`,
    `Uncertainty: ${alert.uncertainty_statement}`,
    `Recommended next step: ${alert.recommended_next_step}`,
    "Synthetic decision support only; human review is required.",
  ].join("\n");

  return (
    <div className="page">
      <Link to="/" className="back">
        <ArrowLeft size={16} />
        Back to queue
      </Link>

      <div className="alert-title">
        <div>
          <div className="badge-row">
            <StatusBadge value={alert.severity} />
            <StatusBadge value={alert.status} />
            <span>{alert.alert_type.replaceAll("_", " ")}</span>
          </div>
          <h1>{alert.summary}</h1>
          <p>
            Created {new Date(alert.created_at).toLocaleString()} · routed to{" "}
            {alert.assigned_role}
          </p>
        </div>
        <div className="language">
          <label>
            Explanation language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
              <option value="banglish">Banglish</option>
            </select>
          </label>
          <div className="handover-actions">
            <button
              className="button ghost"
              onClick={() => void navigator.clipboard.writeText(handover)}
            >
              <Copy size={15} /> Copy for handover
            </button>
            <button className="button ghost" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="explanation-grid">
        <EvidencePanel
          icon={ShieldAlert}
          eyebrow={t.flagged}
          className="primary-evidence"
        >
          <h2>{alert.reason}</h2>
          <p>{t.unusual}</p>
          <pre>{JSON.stringify(alert.evidence, null, 2)}</pre>
        </EvidencePanel>

        <EvidencePanel icon={ClipboardCheck} eyebrow="CONFIDENCE">
          <div className="confidence-score">
            <strong>{Math.round(Number(alert.confidence) * 100)}%</strong>
            <StatusBadge value={alert.data_quality_status} />
          </div>
          <ul>
            {alert.confidence_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </EvidencePanel>

        <EvidencePanel icon={CircleHelp} eyebrow={t.uncertainty}>
          <h2>{alert.uncertainty_statement}</h2>
          <p>This is decision support, not a final fraud determination.</p>
        </EvidencePanel>

        <EvidencePanel
          icon={CheckCircle2}
          eyebrow={t.next}
          className="safe-next"
        >
          <h2>{alert.recommended_next_step}</h2>
          <p>
            No transfer, block, freeze, or automatic financial action is
            available.
          </p>
        </EvidencePanel>
      </div>

      {aiStatus.data?.enabled && (
        <section className="panel ai-panel">
          <div className="panel-heading">
            <div>
              <h2><Sparkles size={17} /> AI-assisted explanation</h2>
              <p>Structured synthetic context only. Human review remains required.</p>
            </div>
            <div className="action-bar">
              {language !== "en" && (
                <button
                  disabled={aiAction.isPending}
                  onClick={() => aiAction.mutate("translate")}
                >
                  Translate
                </button>
              )}
              <button
                disabled={aiAction.isPending}
                onClick={() => aiAction.mutate("summarize")}
              >
                Summarize
              </button>
              {user && ["operations", "risk", "admin"].includes(user.role) && (
                <button
                  disabled={aiAction.isPending}
                  onClick={() => aiAction.mutate("recommendations")}
                >
                  Advisory steps
                </button>
              )}
            </div>
          </div>
          {aiAction.error && <p className="error ai-content">{aiAction.error.message}</p>}
          {aiResult && (
            <div className="ai-content">
              <div className="badge-row">
                <StatusBadge value={aiResult.source} />
                <span>{aiResult.prompt_version}</span>
              </div>
              <pre>{JSON.stringify(aiResult.result, null, 2)}</pre>
              <p><strong>Required uncertainty:</strong> {aiResult.uncertainty}</p>
            </div>
          )}
        </section>
      )}

      <section className="panel workflow">
        <div className="panel-heading">
          <div>
            <h2>Human coordination</h2>
            <p>
              Actions are permission checked and appended to the audit trail.
            </p>
          </div>
          <WorkflowActionBar
            status={alert.status}
            ownerUserId={alert.owner_user_id}
            role={user?.role}
            disabled={action.isPending}
            onAction={(name, body) => action.mutate({ name, body })}
          />
        </div>

        {action.error && (
          <p className="error" role="alert">
            {action.error.message}
          </p>
        )}

        <CaseNoteForm
          roleName={user?.role}
          disabled={action.isPending}
          onSubmit={(content) =>
            action.mutate({ name: "notes", body: { content } })
          }
        />

        <Timeline events={detail.data.events} />
      </section>
    </div>
  );
}
