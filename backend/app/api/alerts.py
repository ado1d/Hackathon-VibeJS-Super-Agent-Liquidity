import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_session
from app.enums import AlertStatus, Role
from app.errors import AppError
from app.models import Agent, Alert, AlertEvent, CaseNote, User
from app.schemas import EscalateRequest, NoteRequest, ResolveRequest
from app.services.alerts import add_note, claim, transition

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def scoped_alert(session: AsyncSession, alert_id: uuid.UUID, user: User) -> Alert:
    alert = await session.get(Alert, alert_id)
    if alert is None:
        raise AppError("ALERT_NOT_FOUND", "Alert was not found.", 404)
    agent = await session.get(Agent, alert.agent_id)
    allowed = (
        user.role == Role.ADMIN
        or (user.role == Role.AGENT and agent and agent.user_id == user.id)
        or (user.role == Role.OPERATIONS and agent and agent.assigned_operations_user_id == user.id)
        or (
            user.role == Role.RISK
            and (alert.assigned_role == Role.RISK or alert.status == AlertStatus.ESCALATED)
        )
    )
    if not allowed:
        raise AppError("AUTH_FORBIDDEN", "This alert is outside your assigned scope.", 403)
    return alert


@router.get("", response_model=None)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    provider_id: uuid.UUID | None = None,
    agent_id: uuid.UUID | None = None,
    area: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    freshness_status: str | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    query = select(Alert).join(Agent, Agent.id == Alert.agent_id)
    if user.role == Role.AGENT:
        query = query.where(Agent.user_id == user.id)
    elif user.role == Role.OPERATIONS:
        query = query.where(Agent.assigned_operations_user_id == user.id)
    elif user.role == Role.RISK:
        query = query.where(
            (Alert.assigned_role == Role.RISK) | (Alert.status == AlertStatus.ESCALATED)
        )
    elif user.role == Role.MANAGEMENT:
        raise AppError(
            "AUTH_FORBIDDEN", "Management access is limited to aggregate summaries.", 403
        )
    if provider_id:
        query = query.where(Alert.provider_id == provider_id)
    if agent_id:
        query = query.where(Alert.agent_id == agent_id)
    if area:
        query = query.where(Agent.area == area)
    if severity:
        query = query.where(Alert.severity == severity)
    if status:
        query = query.where(Alert.status == status)
    if freshness_status:
        query = query.where(Alert.data_quality_status == freshness_status)
    if from_:
        query = query.where(Alert.created_at >= from_)
    if to:
        query = query.where(Alert.created_at <= to)
    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    items = (
        (
            await session.execute(
                query.order_by(Alert.severity, Alert.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/{alert_id}", response_model=None)
async def detail(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    alert = await scoped_alert(session, alert_id, user)
    notes = (
        (
            await session.execute(
                select(CaseNote).where(CaseNote.alert_id == alert.id).order_by(CaseNote.created_at)
            )
        )
        .scalars()
        .all()
    )
    events = (
        (
            await session.execute(
                select(AlertEvent)
                .where(AlertEvent.alert_id == alert.id)
                .order_by(AlertEvent.occurred_at)
            )
        )
        .scalars()
        .all()
    )
    return {
        "alert": alert,
        "notes": notes,
        "events": events,
        "explanation_complete": all(
            [alert.reason, alert.evidence, alert.uncertainty_statement, alert.recommended_next_step]
        ),
    }


@router.get("/{alert_id}/events", response_model=None)
async def events(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AlertEvent]:
    await scoped_alert(session, alert_id, user)
    return list(
        (
            await session.execute(
                select(AlertEvent)
                .where(AlertEvent.alert_id == alert_id)
                .order_by(AlertEvent.occurred_at)
            )
        )
        .scalars()
        .all()
    )


@router.get("/{alert_id}/events.csv")
async def events_csv(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    rows = await events(alert_id, user, session)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["occurred_at", "event_type", "actor_user_id", "from_status", "to_status", "details"]
    )
    for row in rows:
        writer.writerow(
            [
                row.occurred_at.isoformat(),
                row.event_type,
                row.actor_user_id,
                row.from_status,
                row.to_status,
                row.details,
            ]
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=alert-{alert_id}-events.csv"},
    )


@router.post("/{alert_id}/claim", response_model=None)
async def claim_alert(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    if user.role not in {Role.OPERATIONS, Role.RISK, Role.ADMIN}:
        raise AppError("AUTH_FORBIDDEN", "Your role cannot claim alerts.", 403)
    return await claim(session, await scoped_alert(session, alert_id, user), user)


@router.post("/{alert_id}/acknowledge", response_model=None)
async def acknowledge(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    return await transition(
        session, await scoped_alert(session, alert_id, user), AlertStatus.ACKNOWLEDGED, user
    )


@router.post("/{alert_id}/in-progress", response_model=None)
async def in_progress(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    if user.role not in {Role.OPERATIONS, Role.RISK, Role.ADMIN}:
        raise AppError("AUTH_FORBIDDEN", "Your role cannot manage operational status.", 403)
    return await transition(
        session, await scoped_alert(session, alert_id, user), AlertStatus.IN_PROGRESS, user
    )


@router.post("/{alert_id}/escalate", response_model=None)
async def escalate(
    alert_id: uuid.UUID,
    payload: EscalateRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    if user.role not in {Role.OPERATIONS, Role.RISK, Role.ADMIN}:
        raise AppError("AUTH_FORBIDDEN", "Your role cannot escalate alerts.", 403)
    alert = await scoped_alert(session, alert_id, user)
    alert.assigned_role = payload.assigned_role
    if payload.note:
        await add_note(session, alert, user, payload.note, "escalation")
    return await transition(session, alert, AlertStatus.ESCALATED, user)


@router.post("/{alert_id}/resolve", response_model=None)
async def resolve(
    alert_id: uuid.UUID,
    payload: ResolveRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    if user.role not in {Role.OPERATIONS, Role.RISK, Role.ADMIN}:
        raise AppError("AUTH_FORBIDDEN", "Your role cannot resolve operational cases.", 403)
    return await transition(
        session,
        await scoped_alert(session, alert_id, user),
        AlertStatus.RESOLVED,
        user,
        payload.resolution_code,
        payload.note,
    )


@router.post("/{alert_id}/reopen", response_model=None)
async def reopen(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    if user.role not in {Role.OPERATIONS, Role.RISK, Role.ADMIN}:
        raise AppError("AUTH_FORBIDDEN", "Your role cannot reopen cases.", 403)
    return await transition(
        session, await scoped_alert(session, alert_id, user), AlertStatus.REOPENED, user
    )


@router.post("/{alert_id}/notes", response_model=None)
async def create_note(
    alert_id: uuid.UUID,
    payload: NoteRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CaseNote:
    alert = await scoped_alert(session, alert_id, user)
    note_type = "support_request" if user.role == Role.AGENT else payload.note_type
    return await add_note(session, alert, user, payload.content, note_type)
