import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  ShieldAlert,
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
import type { Alert } from "../types";

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

  const detail = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => api<Detail>(`/alerts/${alertId}`),
  });
  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: unknown }) =>
      post(`/alerts/${alertId}/${name}`, body),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["alert", alertId] }),
  });

  if (detail.isLoading) {
    return <div className="loading">Loading evidence and audit timeline…</div>;
  }
  if (!detail.data) {
    return <div className="error-state">{detail.error?.message}</div>;
  }

  const alert = detail.data.alert;
  const t = labels[language];

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
