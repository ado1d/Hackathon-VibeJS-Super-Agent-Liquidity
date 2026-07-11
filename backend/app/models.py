import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import AlertStatus, FeedStatus, Role, Severity, TransactionStatus, TransactionType


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    area: Mapped[str] = mapped_column(String(120), index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), unique=True)
    assigned_operations_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Provider(Base):
    __tablename__ = "providers"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    color: Mapped[str] = mapped_column(String(20), default="#2563eb")


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), index=True)
    label: Mapped[str] = mapped_column(String(160))
    seed: Mapped[int]
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    expected_labels: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    measured_results: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentProviderBalance(Base):
    __tablename__ = "agent_provider_balances"
    __table_args__ = (
        Index("ix_balance_agent_provider_time", "agent_id", "provider_id", "source_timestamp"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id"), index=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    source_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    freshness_status: Mapped[FeedStatus] = mapped_column(Enum(FeedStatus, native_enum=False))
    quality_status: Mapped[FeedStatus] = mapped_column(Enum(FeedStatus, native_enum=False))
    quality_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"))


class CashSnapshot(Base):
    __tablename__ = "cash_snapshots"
    __table_args__ = (Index("ix_cash_agent_time", "agent_id", "source_timestamp"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    source_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    quality_status: Mapped[FeedStatus] = mapped_column(
        Enum(FeedStatus, native_enum=False), default=FeedStatus.FRESH
    )
    quality_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"))


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_tx_agent_provider_time", "agent_id", "provider_id", "occurred_at"),
        UniqueConstraint("external_event_id", name="uq_transaction_external_event"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    external_event_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id"), index=True)
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, native_enum=False)
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, native_enum=False), index=True
    )
    synthetic_customer_id: Mapped[str] = mapped_column(String(120), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    validation_error: Mapped[str | None] = mapped_column(Text)
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"), index=True)


class IngestionQuarantine(Base):
    __tablename__ = "ingestion_quarantine"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    external_event_id: Mapped[str | None] = mapped_column(String(120), index=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    validation_reason: Mapped[str] = mapped_column(Text)
    quarantined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    scenario_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("scenario_runs.id"))


class ProviderFeedStatus(Base):
    __tablename__ = "provider_feed_status"
    __table_args__ = (
        UniqueConstraint("agent_id", "provider_id", "scenario_run_id", name="uq_feed_run"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id"), index=True)
    status: Mapped[FeedStatus] = mapped_column(Enum(FeedStatus, native_enum=False))
    last_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    missing_intervals: Mapped[int] = mapped_column(default=0)
    conflict_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"))


class Forecast(Base):
    __tablename__ = "forecasts"
    __table_args__ = (
        Index("ix_forecast_agent_resource", "agent_id", "provider_id", "calculated_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    provider_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("providers.id"))
    resource_type: Mapped[str] = mapped_column(String(30))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    minimum_buffer: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    net_consumption_per_minute: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    shortage_minutes: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    severity: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False))
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    confidence_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    contributing_factors: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    reliable: Mapped[bool] = mapped_column(Boolean, default=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    horizon_minutes: Mapped[int] = mapped_column(default=360)
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"))


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (Index("ix_alert_queue", "status", "severity", "created_at"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), index=True)
    provider_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("providers.id"))
    alert_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False), index=True)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, native_enum=False), default=AlertStatus.NEW, index=True
    )
    summary: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    confidence_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    data_quality_status: Mapped[FeedStatus] = mapped_column(Enum(FeedStatus, native_enum=False))
    uncertainty_statement: Mapped[str] = mapped_column(Text)
    recommended_next_step: Mapped[str] = mapped_column(Text)
    assigned_role: Mapped[Role] = mapped_column(
        Enum(Role, native_enum=False), default=Role.OPERATIONS
    )
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_code: Mapped[str | None] = mapped_column(String(80))
    scenario_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id"), index=True)


class AlertEvent(Base):
    __tablename__ = "alert_events"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id"), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(80))
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str | None] = mapped_column(String(40))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class CaseNote(Base):
    __tablename__ = "case_notes"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id"), index=True)
    author_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    note_type: Mapped[str] = mapped_column(String(40), default="case_note")
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str | None] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    request_id: Mapped[str | None] = mapped_column(String(80))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
