"""Global synthetic audit timeline for the SALI workspace."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_session
from app.enums import Role
from app.errors import AppError
from app.models import AlertEvent, AuditLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def list_audit_events(
    limit: int = Query(80, ge=1, le=250),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if user.role == Role.AGENT:
        raise AppError("AUTH_FORBIDDEN", "Agents can view alert-specific timelines only.", 403)

    audit_logs = list(
        (
            await session.execute(
                select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    alert_events = list(
        (
            await session.execute(
                select(AlertEvent).order_by(AlertEvent.occurred_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    events: list[dict] = [
        {
            "id": str(item.id),
            "source": "audit_log",
            "type": item.action,
            "entity_type": item.entity_type,
            "entity_id": item.entity_id,
            "actor_user_id": str(item.actor_user_id) if item.actor_user_id else None,
            "details": item.details,
            "occurred_at": item.occurred_at,
        }
        for item in audit_logs
    ] + [
        {
            "id": str(item.id),
            "source": "alert_event",
            "type": item.event_type,
            "entity_type": "alert",
            "entity_id": str(item.alert_id),
            "actor_user_id": str(item.actor_user_id) if item.actor_user_id else None,
            "details": item.details,
            "occurred_at": item.occurred_at,
        }
        for item in alert_events
    ]
    events.sort(key=lambda item: item["occurred_at"], reverse=True)
    return {"items": events[:limit], "total": len(events)}
