import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Map, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Agent } from "../types";

interface Page<T> {
  items: T[];
  total: number;
}

export function ManagementSummary() {
  const agents = useQuery({
    queryKey: ["management-agents"],
    queryFn: () => api<Page<Agent>>("/agents?page_size=100"),
  });
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: () =>
      api<Record<string, string | number | null>>("/metrics/validation"),
  });
  const items = agents.data?.items ?? [];
  const areas = Object.entries(
    items.reduce<Record<string, { count: number; alerts: number }>>(
      (acc, item) => {
        acc[item.area] ??= { count: 0, alerts: 0 };
        acc[item.area].count++;
        acc[item.area].alerts += item.alert_count;
        return acc;
      },
      {},
    ),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NON-SENSITIVE AGGREGATE VIEW</span>
          <h1>Management readiness</h1>
          <p>
            Area pressure and response quality without synthetic customer-level
            details.
          </p>
        </div>
      </div>
      <section className="metric-grid">
        <article className="metric">
          <Map />
          <span>Areas monitored</span>
          <strong>{areas.length}</strong>
        </article>
        <article className="metric">
          <BarChart3 />
          <span>Agents at risk</span>
          <strong>
            {
              items.filter(
                (i) => i.health !== "healthy" && i.health !== "watch",
              ).length
            }
          </strong>
        </article>
        <article className="metric">
          <Clock />
          <span>Open alerts</span>
          <strong>{items.reduce((sum, i) => sum + i.alert_count, 0)}</strong>
        </article>
        <article className="metric">
          <ShieldCheck />
          <span>Explanation coverage</span>
          <strong>
            {metrics.data
              ? `${Math.round(Number(metrics.data.explanation_coverage) * 100)}%`
              : "—"}
          </strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Area hotspot table</h2>
            <p>Prioritized for operational planning.</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Agents</th>
              <th>Open alerts</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            {areas.map(([area, value]) => (
              <tr key={area}>
                <td>
                  <strong>{area}</strong>
                </td>
                <td>{value.count}</td>
                <td>{value.alerts}</td>
                <td>
                  <StatusBadge value={value.alerts ? "warning" : "healthy"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Measured validation evidence</h2>
            <p>
              Calculated from the active labeled scenario; unmeasured values
              remain empty.
            </p>
          </div>
        </div>
        <div className="evidence-metrics">
          {Object.entries(metrics.data ?? {})
            .filter(([, v]) => typeof v === "number")
            .map(([key, value]) => (
              <div key={key}>
                <span>{key.replaceAll("_", " ")}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
