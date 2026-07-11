import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Agent } from "../types";

export function AgentLanding() {
  const agents = useQuery({
    queryKey: ["my-agent"],
    queryFn: () => api<{ items: Agent[] }>("/agents?page_size=1"),
  });
  const agent = agents.data?.items[0];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MY ASSIGNED LOCATION</span>
          <h1>{agent?.name ?? "My liquidity position"}</h1>
          <p>Separate provider balances, shared cash pressure, and support progress.</p>
        </div>
        {agent && (
          <Link className="button primary" to={`/agents/${agent.id}`}>
            Open agent detail
          </Link>
        )}
      </div>
      {agents.isLoading && <div className="loading">Loading assigned location…</div>}
      {agents.error && <div className="error-state">{agents.error.message}</div>}
      {!agents.isLoading && !agent && <div className="empty-state">No agent is assigned.</div>}
    </div>
  );
}
