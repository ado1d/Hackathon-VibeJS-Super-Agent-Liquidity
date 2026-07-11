import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  CircleDollarSign,
  Info,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, post } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Overview } from "../types";

const money = (value: string | number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value));

export function AgentDetail() {
  const { agentId = "" } = useParams();
  const overview = useQuery({
    queryKey: ["overview", agentId],
    queryFn: () => api<Overview>(`/agents/${agentId}/overview`),
  });
  const nearby = useQuery({
    queryKey: ["nearby", agentId],
    queryFn: () =>
      api<{
        agents: { id: string; name: string; distance_km: number }[];
        notice: string;
      }>(`/agents/${agentId}/nearby`),
  });
  const simulation = useMutation({
    mutationFn: (multiplier: number) =>
      post<{
        forecasts: {
          resource_type: string;
          shortage_minutes: string | null;
          severity: string;
        }[];
      }>(`/agents/${agentId}/forecast-simulation`, {
        demand_multiplier: multiplier,
      }),
  });
  if (overview.isLoading)
    return (
      <div className="loading">Calculating separate liquidity positions…</div>
    );
  if (!overview.data)
    return <div className="error-state">{overview.error?.message}</div>;
  const data = overview.data;
  const chart = data.forecasts.map((f) => ({
    name:
      f.resource_type === "shared_cash"
        ? "Shared cash"
        : data.providers.find((p) => p.id === f.provider_id)?.name ||
          "Provider",
    minutes: f.shortage_minutes ? Number(f.shortage_minutes) : 360,
    confidence: Math.round(Number(f.confidence) * 100),
  }));
  return (
    <div className="page">
      <Link to="/" className="back">
        <ArrowLeft size={16} />
        Back to operational view
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {data.agent.code} · {data.agent.area}
          </span>
          <h1>{data.agent.name}</h1>
          <p>
            Scenario {data.active_scenario.code}: {data.active_scenario.label}
          </p>
        </div>
        <StatusBadge
          value={data.data_quality_warning ? "data_issue" : "healthy"}
        />
      </div>
      {data.data_quality_warning && (
        <div className="warning-banner" role="status">
          <Info />
          <div>
            <strong>Data confidence is low</strong>
            <p>
              At least one provider feed is delayed, missing, or conflicting.
              Precise shortage times are suppressed where evidence is
              insufficient.
            </p>
          </div>
        </div>
      )}
      <section className="balance-grid">
        <article className="balance-card cash">
          <div className="card-icon">
            <Banknote />
          </div>
          <span>Shared physical cash</span>
          <strong>
            {data.shared_cash ? money(data.shared_cash.balance) : "Unavailable"}
          </strong>
          <small>One reserve supporting every provider</small>
          {data.shared_cash && (
            <StatusBadge value={data.shared_cash.quality_status} />
          )}
        </article>
        {data.providers.map((provider) => (
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
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Time to safety-buffer pressure</h2>
              <p>
                360 minutes represents no shortage inside the forecast horizon.
              </p>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis unit="m" />
                <Tooltip />
                <Bar dataKey="minutes" fill="#0e7490" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="what-if">
            <label htmlFor="multiplier">What-if demand multiplier</label>
            <input
              id="multiplier"
              type="range"
              min="1"
              max="3"
              step="0.5"
              defaultValue="1"
              onChange={(event) =>
                simulation.mutate(Number(event.target.value))
              }
            />
            <span>
              {simulation.isPending
                ? "Calculating…"
                : simulation.data
                  ? `${simulation.data.forecasts[0]?.shortage_minutes ?? "No"} min projected`
                  : "1× current demand"}
            </span>
            <small>Exploration only; results are not persisted.</small>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Active alerts</h2>
              <p>
                Measured facts, forecasts and recommendations remain distinct.
              </p>
            </div>
          </div>
          <div className="alert-list compact">
            {data.alerts.map((alert) => (
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
                <small>{alert.recommended_next_step}</small>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel nearby">
          <div className="panel-heading">
            <div>
              <h2>
                <Users size={18} />
                Nearby support discovery
              </h2>
              <p>Simulated locations; informational only.</p>
            </div>
          </div>
          {nearby.data?.agents.map((agent) => (
            <div className="nearby-row" key={agent.id}>
              <strong>{agent.name}</strong>
              <span>{agent.distance_km} km</span>
            </div>
          ))}
          <small>{nearby.data?.notice}</small>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Confidence reasons</h2>
              <p>Every deduction is visible.</p>
            </div>
          </div>
          {data.forecasts.map((f) => (
            <div
              className="confidence-row"
              key={`${f.resource_type}-${f.provider_id}`}
            >
              <div>
                <strong>{f.resource_type.replaceAll("_", " ")}</strong>
                <span>{Math.round(Number(f.confidence) * 100)}%</span>
              </div>
              <ul>
                {f.confidence_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
