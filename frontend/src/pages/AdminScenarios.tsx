import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Database, Play, RotateCcw } from "lucide-react";
import { api, post } from "../api";
import { toast } from "sonner";

const scenarios = [
  {
    code: "A",
    title: "Hidden provider shortage",
    detail: "Healthy combined value masks Provider A e-money pressure.",
    expected: "Provider-specific forecast before disruption",
  },
  {
    code: "B",
    title: "Cash pressure + unusual activity",
    detail: "Shared cash falls while repeated near-identical activity appears.",
    expected: "Two independent risks with structured evidence",
  },
  {
    code: "C",
    title: "Feed inconsistency",
    detail: "One feed is missing and another conflicts with ledger movement.",
    expected: "Confidence reduction and safe fallback",
  },
  {
    code: "D",
    title: "Coordinated response",
    detail: "A routed alert is ready for the complete human workflow.",
    expected: "Claim, acknowledge, note, escalate and resolve",
  },
];

export function AdminScenarios() {
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ["scenario-comparison"],
    queryFn: () =>
      api<{
        items: {
          code: string;
          label: string;
          active: boolean;
          seed: number;
          measured_results: {
            alert_count?: number;
            critical_alert_count?: number;
            nearest_shortage_minutes?: number | null;
          };
        }[];
      }>("/metrics/scenarios"),
  });
  const load = useMutation({
    mutationFn: (code: string) =>
      post<{ code: string; label: string; seed: number }>(
        `/admin/scenarios/${code}/load`,
      ),
    onSuccess: () => {
      toast.success("Scenario loaded and analytics recomputed");
      void client.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });
  const reset = useMutation({
    mutationFn: () => post("/admin/scenarios/reset"),
    onSuccess: () => {
      toast.success("Demo state reset");
      void client.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DETERMINISTIC DEMO CONTROL</span>
          <h1>Scenario laboratory</h1>
          <p>Every scenario uses a fixed seed and known expected behavior.</p>
        </div>
        <button className="button ghost" onClick={() => reset.mutate()}>
          <RotateCcw size={16} />
          Reset baseline state
        </button>
      </div>
      <div className="scenario-grid">
        {scenarios.map((item) => (
          <article className="scenario-card" key={item.code}>
            <div className="scenario-code">{item.code}</div>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
            <div className="expected">
              <Check size={16} />
              <span>{item.expected}</span>
            </div>
            <button
              className="button primary"
              disabled={load.isPending}
              onClick={() => load.mutate(item.code)}
            >
              <Play size={16} />
              {load.isPending && load.variables === item.code
                ? "Loading…"
                : `Load Scenario ${item.code}`}
            </button>
          </article>
        ))}
      </div>
      {(load.error || reset.error) && (
        <p className="error" role="alert">
          {(load.error || reset.error)?.message}
        </p>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Database size={18} />
              Scenario comparison
            </h2>
            <p>
              Measured alerts and nearest pressure from each deterministic run.
            </p>
          </div>
        </div>
        <div className="comparison">
          {history.data?.items.map((run) => (
            <div key={`${run.code}-${run.seed}`}>
              <strong>Scenario {run.code}</strong>
              <span>Seed {run.seed}</span>
              <span>
                {run.measured_results?.alert_count ?? 0} alerts ·{" "}
                {run.measured_results?.critical_alert_count ?? 0} critical
              </span>
              <span>
                {run.measured_results?.nearest_shortage_minutes == null
                  ? "No shortage in horizon"
                  : `${Math.round(run.measured_results.nearest_shortage_minutes)} min lead`}
              </span>
              <i
                className="comparison-bar"
                style={{
                  width: `${Math.min(100, (run.measured_results?.critical_alert_count ?? 0) * 20)}%`,
                }}
              />
              {run.active && <Status />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function Status() {
  return <span className="active-run">active</span>;
}
