import { CheckCircle2, AlertCircle, ListChecks } from "lucide-react";
import type { AIResponse } from "../types";

interface AIResultDisplayProps {
  result: AIResponse;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function AIResultDisplay({ result }: AIResultDisplayProps) {
  const { feature, source, cached, model, result: payload, uncertainty } = result;

  return (
    <div className="ai-content">
      <div className="ai-meta">
        <span className="badge badge-watch">{source}</span>
        {cached && <span className="badge badge-fresh">cached</span>}
        <span className="ai-model">{model}</span>
      </div>

      {feature === "translate" && (
        <TranslateDisplay payload={payload} />
      )}

      {feature === "summarize" && (
        <SummarizeDisplay payload={payload} />
      )}

      {feature === "recommendations" && (
        <RecommendationsDisplay payload={payload} />
      )}

      <div className="ai-uncertainty">
        <AlertCircle size={14} />
        <span>{uncertainty}</span>
      </div>
    </div>
  );
}

function TranslateDisplay({ payload }: { payload: Record<string, unknown> }) {
  const summary = isString(payload.summary) ? payload.summary : "";
  const reason = isString(payload.reason) ? payload.reason : "";
  const nextStep = isString(payload.recommended_next_step)
    ? payload.recommended_next_step
    : "";

  return (
    <div className="ai-translation">
      <div className="ai-field">
        <span className="ai-label">Summary</span>
        <p>{summary}</p>
      </div>
      <div className="ai-field">
        <span className="ai-label">Why flagged</span>
        <p>{reason}</p>
      </div>
      <div className="ai-field ai-next-step">
        <CheckCircle2 size={15} />
        <div>
          <span className="ai-label">Recommended next step</span>
          <p>{nextStep}</p>
        </div>
      </div>
    </div>
  );
}

function SummarizeDisplay({ payload }: { payload: Record<string, unknown> }) {
  const headline = isString(payload.headline) ? payload.headline : "";
  const situation = isString(payload.situation) ? payload.situation : "";
  const evidencePoints = isStringArray(payload.evidence_points)
    ? payload.evidence_points
    : [];
  const nextStep = isString(payload.recommended_next_step)
    ? payload.recommended_next_step
    : "";

  return (
    <div className="ai-summary">
      <h3>{headline}</h3>
      <p className="ai-situation">{situation}</p>
      {evidencePoints.length > 0 && (
        <div className="ai-evidence">
          <span className="ai-label">Key evidence:</span>
          <ul>
            {evidencePoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="ai-field ai-next-step">
        <CheckCircle2 size={15} />
        <div>
          <span className="ai-label">Recommended next step</span>
          <p>{nextStep}</p>
        </div>
      </div>
    </div>
  );
}

function RecommendationsDisplay({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const advisory = isStringArray(payload.advisory_actions)
    ? payload.advisory_actions
    : [];
  const prohibited = isStringArray(payload.prohibited_actions)
    ? payload.prohibited_actions
    : [];

  return (
    <div className="ai-recommendations">
      <div className="ai-rec-section">
        <span className="ai-label">
          <ListChecks size={15} /> Advisory actions (human picks one)
        </span>
        <ol>
          {advisory.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ol>
      </div>
      {prohibited.length > 0 && (
        <div className="ai-rec-section ai-prohibited">
          <span className="ai-label">Actions this prototype will NOT perform:</span>
          <ul>
            {prohibited.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
