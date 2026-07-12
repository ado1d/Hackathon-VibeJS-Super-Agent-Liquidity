import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer } from "recharts";
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
              <th>Separate balances</th>
              <th>Projected pressure</th>
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
                  <div className="balance-minis">
                    <span>Cash <strong>{formatMoney(agent.balances.cash)}</strong></span>
                    {Object.entries(agent.balances.providers).map(([code, balance]) => (
                      <span key={code}>{providerLabel(code)} <strong>{formatMoney(balance)}</strong></span>
                    ))}
                  </div>
                </td>
                <td>
                  <PressureSparkline agent={agent} />
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

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-BD", { notation: "compact" }).format(value);
}

function providerLabel(code: string) {
  const labels: Record<string, string> = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    PROVIDER_A: "bKash",
    PROVIDER_B: "Nagad",
  };
  return labels[code] ?? code;
}

function PressureSparkline({ agent }: { agent: Agent }) {
  const pressure = [...agent.pressure_points].sort(
    (a, b) => (a.shortage_minutes ?? 9999) - (b.shortage_minutes ?? 9999),
  )[0];
  if (!pressure) return <small>No measured pressure</small>;
  const end = pressure.shortage_minutes == null
    ? Math.max(pressure.minimum_buffer, pressure.current_balance * 0.85)
    : pressure.minimum_buffer;
  return (
    <div className="pressure-spark" title={`${pressure.resource_type.replaceAll("_", " ")} projection`}>
      <ResponsiveContainer width={100} height={34}>
        <LineChart data={[{ balance: pressure.current_balance }, { balance: end }]}>
          <Line type="monotone" dataKey="balance" stroke="#0e7490" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <small>{pressure.resource_type.replaceAll("_", " ")}</small>
    </div>
  );
}
