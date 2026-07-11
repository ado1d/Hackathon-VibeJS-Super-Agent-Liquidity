import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.config import get_settings
from app.database import get_session
from app.enums import Role, TransactionStatus, TransactionType
from app.models import (Agent, AgentProviderBalance, CashSnapshot, IngestionQuarantine,
                        Provider, ScenarioRun, Transaction, User)
from app.schemas import IsolationForestConfigRequest, TransactionImportItem
from app.services.audit import add_audit
from app.services.scenarios import load_scenario, recompute_agent, reset_operational_data

router = APIRouter(prefix="/admin", tags=["administration"])


@router.post("/scenarios/{scenario_code}/load")
async def scenario_load(scenario_code: str, actor: User = Depends(require_roles(Role.ADMIN)),
                        session: AsyncSession = Depends(get_session)) -> dict:
    run = await load_scenario(session, scenario_code, actor.id)
    return {"id": run.id, "code": run.code, "label": run.label, "seed": run.seed,
            "active": run.active, "expected_labels": run.expected_labels}


@router.post("/scenarios/reset")
async def scenario_reset(actor: User = Depends(require_roles(Role.ADMIN)),
                         session: AsyncSession = Depends(get_session)) -> dict:
    await reset_operational_data(session)
    add_audit(session, "scenario.reset", actor.id, "scenario", "all")
    await session.commit()
    return {"status": "reset", "known_state": True}


@router.get("/isolation-forest")
async def get_iforest(actor: User = Depends(require_roles(Role.ADMIN))) -> dict:
    return {"enabled": get_settings().enable_isolation_forest,
            "notice": "Secondary statistical signal only; explainable rules remain authoritative."}


@router.post("/isolation-forest")
async def set_iforest(payload: IsolationForestConfigRequest,
                      actor: User = Depends(require_roles(Role.ADMIN)),
                      session: AsyncSession = Depends(get_session)) -> dict:
    # Runtime-only demo switch; environment configuration remains the deployment source of truth.
    settings = get_settings()
    settings.enable_isolation_forest = payload.enabled
    add_audit(session, "analytics.isolation_forest_toggled", actor.id, "configuration", "iforest",
              details={"enabled": payload.enabled})
    await session.commit()
    return {"enabled": payload.enabled, "persisted": False}


@router.post("/transactions/import")
async def import_transactions(payload: list[dict[str, Any]],
                              actor: User = Depends(require_roles(Role.ADMIN)),
                              session: AsyncSession = Depends(get_session)) -> dict:
    run = (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True)))).scalars().first()
    if run is None:
        from app.errors import AppError
        raise AppError("SCENARIO_NOT_LOADED", "Load a scenario before importing transactions.", 409)
    agents = {row.code: row for row in (await session.execute(select(Agent))).scalars()}
    providers = {row.code: row for row in (await session.execute(select(Provider))).scalars()}
    existing_ids = set((await session.execute(select(Transaction.external_event_id).where(
        Transaction.external_event_id.is_not(None)))).scalars())
    accepted = 0
    quarantined = 0
    affected_agents: set[uuid.UUID] = set()
    for raw in payload:
        external_id = str(raw.get("external_event_id")) if raw.get("external_event_id") else None
        try:
            item = TransactionImportItem.model_validate(raw)
            if item.external_event_id in existing_ids:
                raise ValueError("external_event_id already exists")
            agent = agents.get(item.agent_code)
            provider = providers.get(item.provider_code)
            if agent is None or provider is None:
                raise ValueError("agent_code or provider_code is unknown")
            if item.status == TransactionStatus.SUCCESS:
                balance = (await session.execute(select(AgentProviderBalance).where(
                    AgentProviderBalance.agent_id == agent.id,
                    AgentProviderBalance.provider_id == provider.id,
                    AgentProviderBalance.scenario_run_id == run.id
                ).order_by(AgentProviderBalance.source_timestamp.desc()))).scalars().first()
                cash = (await session.execute(select(CashSnapshot).where(
                    CashSnapshot.agent_id == agent.id, CashSnapshot.scenario_run_id == run.id
                ).order_by(CashSnapshot.source_timestamp.desc()))).scalars().first()
                if balance is None or cash is None:
                    raise ValueError("complete provider and cash balance context is required")
                if item.transaction_type == TransactionType.CASH_IN:
                    balance.balance -= item.amount
                    cash.balance += item.amount
                elif item.transaction_type == TransactionType.CASH_OUT:
                    balance.balance += item.amount
                    cash.balance -= item.amount
            session.add(Transaction(external_event_id=item.external_event_id, agent_id=agent.id,
                                    provider_id=provider.id, transaction_type=item.transaction_type,
                                    amount=item.amount, status=item.status,
                                    synthetic_customer_id=item.synthetic_customer_id,
                                    occurred_at=item.occurred_at, scenario_run_id=run.id))
            affected_agents.add(agent.id)
            existing_ids.add(item.external_event_id)
            accepted += 1
        except (ValidationError, ValueError) as exc:
            session.add(IngestionQuarantine(external_event_id=external_id, raw_payload=raw,
                                            validation_reason=str(exc), scenario_run_id=run.id))
            quarantined += 1
    await session.flush()
    for agent_id in affected_agents:
        await recompute_agent(session, run, agent_id)
    add_audit(session, "transactions.imported", actor.id, "scenario_run", str(run.id),
              details={"accepted": accepted, "quarantined": quarantined})
    await session.commit()
    return {"accepted": accepted, "quarantined": quarantined,
            "forecast_recalculation": "completed"}
