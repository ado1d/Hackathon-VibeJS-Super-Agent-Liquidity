import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import (AlertStatus, FeedStatus, ResolutionCode, Role, Severity,
                       TransactionStatus, TransactionType)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class SwitchRoleRequest(BaseModel):
    role: Role


class UserView(ORMModel):
    id: uuid.UUID
    username: str
    display_name: str
    role: Role
    permissions: list[str] = []


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserView


class Page(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int


class NoteRequest(BaseModel):
    content: str = Field(min_length=2, max_length=4000)
    note_type: str = Field(default="case_note", max_length=40)


class EscalateRequest(BaseModel):
    assigned_role: Role = Role.RISK
    note: str | None = Field(default=None, max_length=1000)


class ResolveRequest(BaseModel):
    resolution_code: ResolutionCode
    note: str = Field(min_length=3, max_length=4000)


class ForecastSimulationRequest(BaseModel):
    demand_multiplier: float = Field(ge=1.0, le=3.0)


class IsolationForestConfigRequest(BaseModel):
    enabled: bool


class TransactionImportItem(BaseModel):
    external_event_id: str = Field(min_length=1, max_length=120)
    agent_code: str = Field(min_length=1, max_length=40)
    provider_code: str = Field(min_length=1, max_length=40)
    transaction_type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    status: TransactionStatus
    synthetic_customer_id: str = Field(min_length=1, max_length=120)
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class ForecastView(ORMModel):
    resource_type: str
    provider_id: uuid.UUID | None
    current_balance: Decimal
    minimum_buffer: Decimal
    net_consumption_per_minute: Decimal
    shortage_minutes: Decimal | None
    severity: Severity
    confidence: Decimal
    confidence_reasons: list[str]
    contributing_factors: dict[str, Any]
    reliable: bool
    horizon_minutes: int


class AlertView(ORMModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    provider_id: uuid.UUID | None
    alert_type: str
    severity: Severity
    status: AlertStatus
    summary: str
    reason: str
    evidence: dict[str, Any]
    confidence: Decimal
    confidence_reasons: list[str]
    data_quality_status: FeedStatus
    uncertainty_statement: str
    recommended_next_step: str
    assigned_role: Role
    owner_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolution_code: str | None
