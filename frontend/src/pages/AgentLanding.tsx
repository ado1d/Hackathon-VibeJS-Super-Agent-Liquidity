import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CircleDollarSign } from "lucide-react";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Agent, Alert, Overview } from "../types";

const money = (value: string | number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value));

export function AgentLanding() {
  const agents = useQuery({
    queryKey: ["my-agent"],
    queryFn: () => api<{ items: Agent[] }>("/agents?page_size=1"),
  });
  const agent = agents.data?.items[0];

  const overview = useQuery({
    queryKey: ["my-overview", agent?.id],
    queryFn: () => api<Overview>(`/agents/${agent?.id}/overview`),
    enabled: !!agent?.id,
  });

  const alerts = useQuery({
    queryKey: ["my-alerts"],
    queryFn: () => api<{ items: Alert[] }>("/alerts?page_size=5"),
  });

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MY ASSIGNED LOCATION</span>
          <h1>{agent?.name ?? "My liquidity position"}</h1>
          <p>
            Separate provider balances, shared cash pressure, and support
            progress.
          </p>
        </div>
        {agent && (
          <Link className="button primary" to={`/agents/${agent.id}`}>
            Open full detail <ArrowRight size={16} />
          </Link>
        )}
      </div>

      {agents.isLoading && (
        <div className="loading">Loading assigned location…</div>
      )}
      {agents.error && (
        <div className="error-state">{agents.error.message}</div>
      )}
      {!agents.isLoading && !agent && (
        <div className="empty-state">No agent is assigned to your account.</div>
      )}

      {overview.data && (
        <>
          <section className="balance-grid">
            <article className="balance-card cash">
              <div className="card-icon">
                <Banknote />
              </div>
              <span>Shared physical cash</span>
              <strong>
                {overview.data.shared_cash
                  ? money(overview.data.shared_cash.balance)
                  : "Unavailable"}
              </strong>
              <small>One reserve supporting every provider</small>
              {overview.data.shared_cash && (
                <StatusBadge value={overview.data.shared_cash.quality_status} />
              )}
            </article>
            {overview.data.providers.map((provider) => (
              <article
                className="balance-card"
                key={provider.id}
                style={{ borderTopColor: provider.color }}
              >
                <div className="card-icon">
                  <CircleDollarSign />
                </div>
                <span>{provider.name} e-money</span>
                <strong>{money(provider.balance)}</strong>
                <small>Not interchangeable with another provider</small>
                <StatusBadge value={provider.quality_status} />
              </article>
            ))}
          </section>

          {overview.data.data_quality_warning && (
            <div className="warning-banner" role="status">
              <strong>Data confidence is low</strong>
              <p>
                At least one provider feed is delayed, missing, or conflicting.
                Precise shortage times are suppressed where evidence is
                insufficient.
              </p>
            </div>
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>My active alerts</h2>
                <p>
                  Acknowledge your own alerts or request operational support
                  below.
                </p>
              </div>
            </div>
            <div className="alert-list compact">
              {(alerts.data?.items ?? []).map((alert) => (
                <Link
                  to={`/alerts/${alert.id}`}
                  className="alert-row"
                  key={alert.id}
                >
                  <div>
                    <StatusBadge value={alert.severity} />
                    <span>{alert.alert_type.replaceAll("_", " ")}</span>
                  </div>
                  <strong>{alert.summary}</strong>
                  <small>
                    {alert.status.replaceAll("_", " ")} ·{" "}
                    {alert.recommended_next_step}
                  </small>
                </Link>
              ))}
              {!alerts.data?.items.length && (
                <div className="empty">No active alerts. You're all clear.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
