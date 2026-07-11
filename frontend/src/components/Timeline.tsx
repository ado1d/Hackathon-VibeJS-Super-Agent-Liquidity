interface AlertEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
}

interface TimelineProps {
  events: AlertEvent[];
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="timeline-event" key={event.id}>
          <span />
          <div>
            <strong>{event.event_type.replaceAll("_", " ")}</strong>
            <p>
              {event.from_status && `${event.from_status} → `}
              {event.to_status}
            </p>
            <small>{new Date(event.occurred_at).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
