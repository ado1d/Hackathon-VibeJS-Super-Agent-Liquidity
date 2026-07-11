import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { AgentLiquidityTable } from "../components/AgentLiquidityTable";
import { MetricGrid } from "../components/MetricGrid";
import { PriorityQueue } from "../components/PriorityQueue";
import type { Agent, Alert } from "../types";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

interface Page<T> {
  items: T[];
  total: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api<Page<Agent>>("/agents?page_size=50"),
  });
  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<Page<Alert>>("/alerts?page_size=50"),
    enabled: user?.role !== "management",
  });

  if (agents.isLoading) {
    return (
      <div className="page" aria-label="Loading operational picture">
        <Skeleton height={80} count={4} />
      </div>
    );
  }
  if (agents.error) {
    return (
      <div className="error-state">
        <h2>Operational view unavailable</h2>
        <p>{agents.error.message}</p>
      </div>
    );
  }

  const agentItems = agents.data?.items ?? [];
  const alertItems = alerts.data?.items ?? [];

  if (user?.role === "management") {
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">MANAGEMENT ACCESS</span>
            <h1>Area readiness</h1>
            <p>
              Aggregate operational context without customer-level evidence.
            </p>
          </div>
          <Link to="/management" className="button primary">
            Open management summary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LIVE SYNTHETIC VIEW</span>
          <h1>
            {user?.role === "agent"
              ? "My liquidity position"
              : user?.role === "risk"
                ? "Evidence review queue"
                : "Operations cockpit"}
          </h1>
          <p>
            Measured balances, forward pressure and coordinated response—kept
            clearly separate.
          </p>
        </div>
        <div className="updated">
          <span className="pulse" />
          Deterministic scenario active
        </div>
      </div>

      <MetricGrid agents={agentItems} alerts={alertItems} />

      <div className="dashboard-grid">
        <AgentLiquidityTable agents={agentItems} />
        <PriorityQueue alerts={alertItems} />
      </div>
    </div>
  );
}
