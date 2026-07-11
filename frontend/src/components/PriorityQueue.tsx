import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
import type { Alert } from "../types";

interface PriorityQueueProps {
  alerts: Alert[];
  limit?: number;
}

export function PriorityQueue({ alerts, limit = 8 }: PriorityQueueProps) {
  const visible = alerts.slice(0, limit);
  return (
    <section className="panel queue">
      <div className="panel-heading">
        <div>
          <h2>Priority queue</h2>
          <p>Human review required</p>
        </div>
      </div>
      <div className="alert-list">
        {visible.map((alert) => (
          <Link to={`/alerts/${alert.id}`} className="alert-row" key={alert.id}>
            <div>
              <StatusBadge value={alert.severity} />
              <span className="alert-type">
                {alert.alert_type.replaceAll("_", " ")}
              </span>
            </div>
            <strong>{alert.summary}</strong>
            <small>
              {alert.status.replaceAll("_", " ")} · confidence{" "}
              {Math.round(Number(alert.confidence) * 100)}%
            </small>
          </Link>
        ))}
        {!visible.length && (
          <div className="empty">No alerts in this queue.</div>
        )}
      </div>
    </section>
  );
}
