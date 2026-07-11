import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import AlertStatus, FeedStatus, ResolutionCode, Role, Severity
from app.errors import AppError
from app.models import Alert, CaseNote, User, utcnow
from app.services.audit import add_alert_event, add_audit

TRANSITIONS: dict[AlertStatus, set[AlertStatus]] = {
    AlertStatus.NEW: {AlertStatus.ACKNOWLEDGED, AlertStatus.IN_PROGRESS, AlertStatus.ESCALATED},
    AlertStatus.ACKNOWLEDGED: {AlertStatus.IN_PROGRESS, AlertStatus.ESCALATED, AlertStatus.RESOLVED},
    AlertStatus.IN_PROGRESS: {AlertStatus.ESCALATED, AlertStatus.RESOLVED},
    AlertStatus.ESCALATED: {AlertStatus.IN_PROGRESS, AlertStatus.RESOLVED},
    AlertStatus.RESOLVED: {AlertStatus.REOPENED},
    AlertStatus.REOPENED: {AlertStatus.ACKNOWLEDGED, AlertStatus.IN_PROGRESS,
                           AlertStatus.ESCALATED, AlertStatus.RESOLVED},
}


def validate_transition(current: AlertStatus, target: AlertStatus) -> None:
    if target not in TRANSITIONS[current]:
        raise AppError("ALERT_INVALID_TRANSITION",
                       f"An alert in '{current.value}' cannot transition to '{target.value}'.", 409,
                       {"from": current.value, "allowed": sorted(item.value for item in TRANSITIONS[current])})


async def transition(session: AsyncSession, alert: Alert, target: AlertStatus, actor: User,
                     resolution_code: ResolutionCode | None = None, note: str | None = None) -> Alert:
    validate_transition(alert.status, target)
    if target == AlertStatus.RESOLVED and (resolution_code is None or not note or len(note.strip()) < 3):
        raise AppError("ALERT_RESOLUTION_REQUIRED", "Resolution code and note are required.", 422)
    previous = alert.status
    alert.status = target
    alert.updated_at = utcnow()
    details: dict[str, Any] = {}
    if target == AlertStatus.RESOLVED:
        alert.resolution_code = resolution_code.value if resolution_code else None
        alert.resolved_at = utcnow()
        details["resolution_code"] = alert.resolution_code
        session.add(CaseNote(alert_id=alert.id, author_user_id=actor.id,
                             note_type="resolution", content=note or ""))
    elif target == AlertStatus.REOPENED:
        alert.resolved_at = None
        alert.resolution_code = None
    add_alert_event(session, alert.id, "status_changed", actor.id, previous.value, target.value, details)
    add_audit(session, "alert.status_changed", actor.id, "alert", str(alert.id),
              details={"from": previous.value, "to": target.value, **details})
    await session.commit()
    await session.refresh(alert)
    return alert


async def claim(session: AsyncSession, alert: Alert, actor: User) -> Alert:
    previous = str(alert.owner_user_id) if alert.owner_user_id else None
    alert.owner_user_id = actor.id
    alert.updated_at = utcnow()
    add_alert_event(session, alert.id, "owner_changed", actor.id,
                    details={"previous_owner": previous, "owner": str(actor.id)})
    add_audit(session, "alert.claimed", actor.id, "alert", str(alert.id))
    await session.commit()
    await session.refresh(alert)
    return alert


async def add_note(session: AsyncSession, alert: Alert, actor: User, content: str,
                   note_type: str = "case_note") -> CaseNote:
    note = CaseNote(alert_id=alert.id, author_user_id=actor.id, content=content, note_type=note_type)
    session.add(note)
    add_alert_event(session, alert.id, "note_added", actor.id,
                    details={"note_type": note_type, "preview": content[:120]})
    add_audit(session, "alert.note_added", actor.id, "alert", str(alert.id))
    await session.commit()
    await session.refresh(note)
    return note


async def upsert_alert(session: AsyncSession, *, agent_id: uuid.UUID, provider_id: uuid.UUID | None,
                       alert_type: str, severity: Severity, summary: str, reason: str,
                       evidence: dict[str, Any], confidence: float, confidence_reasons: list[str],
                       data_quality_status: FeedStatus, uncertainty: str, next_step: str,
                       scenario_run_id: uuid.UUID, assigned_role: Role = Role.OPERATIONS,
                       cooldown_minutes: int = 30) -> Alert:
    cutoff = utcnow() - timedelta(minutes=cooldown_minutes)
    provider_match = Alert.provider_id.is_(None) if provider_id is None else Alert.provider_id == provider_id
    query = select(Alert).where(and_(Alert.agent_id == agent_id, provider_match,
                                    Alert.alert_type == alert_type, Alert.status != AlertStatus.RESOLVED,
                                    Alert.last_detected_at >= cutoff)).order_by(Alert.last_detected_at.desc())
    existing = (await session.execute(query)).scalars().first()
    if existing:
        existing.severity = severity
        existing.summary = summary
        existing.reason = reason
        existing.evidence = evidence
        existing.confidence = Decimal(str(confidence))
        existing.confidence_reasons = confidence_reasons
        existing.data_quality_status = data_quality_status
        existing.uncertainty_statement = uncertainty
        existing.recommended_next_step = next_step
        existing.last_detected_at = utcnow()
        add_alert_event(session, existing.id, "detection_refreshed", details={"severity": severity.value})
        return existing
    alert = Alert(agent_id=agent_id, provider_id=provider_id, alert_type=alert_type,
                  severity=severity, summary=summary, reason=reason, evidence=evidence,
                  confidence=Decimal(str(confidence)), confidence_reasons=confidence_reasons,
                  data_quality_status=data_quality_status, uncertainty_statement=uncertainty,
                  recommended_next_step=next_step, assigned_role=assigned_role,
                  scenario_run_id=scenario_run_id)
    session.add(alert)
    await session.flush()
    add_alert_event(session, alert.id, "alert_created", details={"severity": severity.value})
    return alert

