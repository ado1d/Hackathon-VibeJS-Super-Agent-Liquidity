import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
import type { Agent } from "../types";

interface AgentLiquidityTableProps {
  agents: Agent[];
}

export function AgentLiquidityTable({ agents }: AgentLiquidityTableProps) {
  return (
    <section className="panel wide">
      <div className="panel-heading">
        <div>
          <h2>Agent liquidity map</h2>
          <p>Provider risks are never hidden inside a combined total.</p>
        </div>
        <div className="filters">
          <select aria-label="Filter area">
            <option>All areas</option>
            <option>Dhaka North</option>
            <option>Dhaka South</option>
          </select>
          <select aria-label="Filter severity">
            <option>All severity</option>
            <option>Critical</option>
            <option>High</option>
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Area</th>
              <th>Nearest shortage</th>
              <th>Health</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <Link to={`/agents/${agent.id}`}>
                    <strong>{agent.name}</strong>
                    <small>{agent.code}</small>
                  </Link>
                </td>
                <td>
                  <MapPin size={14} />
                  {agent.area}
                </td>
                <td>
                  {agent.nearest_shortage_minutes == null
                    ? "No projected shortage"
                    : `${Math.round(agent.nearest_shortage_minutes)} minutes`}
                </td>
                <td>
                  <StatusBadge value={agent.health} />
                </td>
                <td>{agent.alert_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
