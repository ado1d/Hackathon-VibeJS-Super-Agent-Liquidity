import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { PriorityQueue } from "../components/PriorityQueue";
import type { Alert } from "../types";

export function RiskQueue() {
  const alerts = useQuery({
    queryKey: ["risk-review-queue"],
    queryFn: () => api<{ items: Alert[] }>("/alerts?page_size=100"),
  });
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESCALATED SYNTHETIC CASES</span>
          <h1>Evidence review queue</h1>
          <p>Human review only. An unusual pattern is not proof of wrongdoing.</p>
        </div>
      </div>
      {alerts.isLoading ? (
        <div className="loading">Loading review queue…</div>
      ) : alerts.error ? (
        <div className="error-state">{alerts.error.message}</div>
      ) : (
        <PriorityQueue alerts={alerts.data?.items ?? []} />
      )}
    </div>
  );
}
