import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertEvent, AuditLog


def add_audit(session: AsyncSession, action: str, actor_user_id: uuid.UUID | None = None,
              entity_type: str | None = None, entity_id: str | None = None,
              request_id: str | None = None, details: dict[str, Any] | None = None) -> AuditLog:
    row = AuditLog(actor_user_id=actor_user_id, action=action, entity_type=entity_type,
                   entity_id=entity_id, request_id=request_id, details=details or {})
    session.add(row)
    return row


def add_alert_event(session: AsyncSession, alert_id: uuid.UUID, event_type: str,
                    actor_user_id: uuid.UUID | None = None, from_status: str | None = None,
                    to_status: str | None = None, details: dict[str, Any] | None = None) -> AlertEvent:
    event = AlertEvent(alert_id=alert_id, actor_user_id=actor_user_id, event_type=event_type,
                       from_status=from_status, to_status=to_status, details=details or {})
    session.add(event)
    return event

