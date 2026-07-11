import uuid
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.config import get_settings
from app.database import get_session
from app.enums import Role, TransactionStatus, TransactionType
from app.models import (
    Agent,
    AgentProviderBalance,
    CashSnapshot,
    IngestionQuarantine,
    Provider,
    ScenarioRun,
    Transaction,
    User,
)
from app.schemas import IsolationForestConfigRequest, TransactionImportItem
from app.services.audit import add_audit
from app.services.scenarios import (
    load_scenario,
    recompute_agent,
    reset_operational_data,
    update_measured_results,
)

router = APIRouter(prefix="/admin", tags=["administration"])


def _utc(value: datetime) -> datetime:
    """Normalize SQLite's timezone-naive round trip for deterministic comparisons."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


@router.post("/scenarios/{scenario_code}/load")
async def scenario_load(
    scenario_code: str,
    actor: User = Depends(require_roles(Role.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    run = await load_scenario(session, scenario_code, actor.id)
    return {
        "id": run.id,
        "code": run.code,
        "label": run.label,
        "seed": run.seed,
        "active": run.active,
        "expected_labels": run.expected_labels,
    }


@router.post("/scenarios/reset")
async def scenario_reset(
    actor: User = Depends(require_roles(Role.ADMIN)), session: AsyncSession = Depends(get_session)
) -> dict:
    await reset_operational_data(session)
    add_audit(session, "scenario.reset", actor.id, "scenario", "all")
    await session.commit()
    return {"status": "reset", "known_state": True}


@router.get("/isolation-forest")
async def get_iforest(actor: User = Depends(require_roles(Role.ADMIN))) -> dict:
    return {
        "enabled": get_settings().enable_isolation_forest,
        "notice": "Secondary statistical signal only; explainable rules remain authoritative.",
    }


@router.post("/isolation-forest")
async def set_iforest(
    payload: IsolationForestConfigRequest,
    actor: User = Depends(require_roles(Role.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Runtime-only demo switch; environment configuration remains the deployment source of truth.
    settings = get_settings()
    settings.enable_isolation_forest = payload.enabled
    add_audit(
        session,
        "analytics.isolation_forest_toggled",
        actor.id,
        "configuration",
        "iforest",
        details={"enabled": payload.enabled},
    )
    await session.commit()
    return {"enabled": payload.enabled, "persisted": False}


@router.post("/transactions/import")
async def import_transactions(
    payload: list[dict[str, Any]],
    actor: User = Depends(require_roles(Role.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    run = (
        (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True))))
        .scalars()
        .first()
    )
    if run is None:
        from app.errors import AppError

        raise AppError("SCENARIO_NOT_LOADED", "Load a scenario before importing transactions.", 409)
    agents = {row.code: row for row in (await session.execute(select(Agent))).scalars()}
    providers = {row.code: row for row in (await session.execute(select(Provider))).scalars()}
    provider_context = set(
        (
            await session.execute(
                select(AgentProviderBalance.agent_id, AgentProviderBalance.provider_id).where(
                    AgentProviderBalance.scenario_run_id == run.id
                )
            )
        ).all()
    )
    cash_context = set(
        (
            await session.execute(
                select(CashSnapshot.agent_id).where(CashSnapshot.scenario_run_id == run.id)
            )
        ).scalars()
    )
    existing_ids = set(
        (
            await session.execute(
                select(Transaction.external_event_id).where(
                    Transaction.external_event_id.is_not(None)
                )
            )
        ).scalars()
    )
    accepted_items: list[tuple[TransactionImportItem, Agent, Provider]] = []
    quarantined = 0
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
            if (agent.id, provider.id) not in provider_context or agent.id not in cash_context:
                raise ValueError("complete provider and cash balance context is required")
            accepted_items.append((item, agent, provider))
            existing_ids.add(item.external_event_id)
        except (ValidationError, ValueError) as exc:
            session.add(
                IngestionQuarantine(
                    external_event_id=external_id,
                    raw_payload=raw,
                    validation_reason=str(exc),
                    scenario_run_id=run.id,
                )
            )
            quarantined += 1

    # All records are validated before any balance calculation. Accepted rows
    # then move balances as one immutable-snapshot batch per agent/provider.
    by_agent: dict[uuid.UUID, list[tuple[TransactionImportItem, Agent, Provider]]] = defaultdict(
        list
    )
    for item, agent, provider in accepted_items:
        by_agent[agent.id].append((item, agent, provider))
        session.add(
            Transaction(
                external_event_id=item.external_event_id,
                agent_id=agent.id,
                provider_id=provider.id,
                transaction_type=item.transaction_type,
                amount=item.amount,
                status=item.status,
                synthetic_customer_id=item.synthetic_customer_id,
                occurred_at=item.occurred_at,
                scenario_run_id=run.id,
            )
        )

    received_at = datetime.now(timezone.utc)
    for agent_id, agent_items in by_agent.items():
        provider_groups: dict[
            uuid.UUID, list[tuple[TransactionImportItem, Agent, Provider]]
        ] = defaultdict(list)
        for accepted_item in agent_items:
            provider_groups[accepted_item[2].id].append(accepted_item)

        for provider_id, provider_items in provider_groups.items():
            previous = (
                (
                    await session.execute(
                        select(AgentProviderBalance)
                        .where(
                            AgentProviderBalance.agent_id == agent_id,
                            AgentProviderBalance.provider_id == provider_id,
                            AgentProviderBalance.scenario_run_id == run.id,
                        )
                        .order_by(
                            AgentProviderBalance.source_timestamp.desc(),
                            AgentProviderBalance.received_timestamp.desc(),
                            AgentProviderBalance.id.desc(),
                        )
                        .with_for_update()
                    )
                )
                .scalars()
                .first()
            )
            if previous is None:
                raise ValueError("complete provider and cash balance context is required")
            provider_delta = Decimal("0")
            for item, _, _ in provider_items:
                if item.status != TransactionStatus.SUCCESS:
                    continue
                provider_delta += (
                    item.amount
                    if item.transaction_type == TransactionType.CASH_OUT
                    else -item.amount
                )
            source_at = max(
                _utc(previous.source_timestamp),
                max(_utc(item.occurred_at) for item, _, _ in provider_items),
            )
            session.add(
                AgentProviderBalance(
                    agent_id=agent_id,
                    provider_id=provider_id,
                    balance=previous.balance + provider_delta,
                    source_timestamp=source_at,
                    received_timestamp=received_at,
                    freshness_status=previous.freshness_status,
                    quality_status=previous.quality_status,
                    quality_details={"derived_from_import_batch": True},
                    scenario_run_id=run.id,
                )
            )

        previous_cash = (
            (
                await session.execute(
                    select(CashSnapshot)
                    .where(
                        CashSnapshot.agent_id == agent_id,
                        CashSnapshot.scenario_run_id == run.id,
                    )
                    .order_by(
                        CashSnapshot.source_timestamp.desc(),
                        CashSnapshot.received_timestamp.desc(),
                        CashSnapshot.id.desc(),
                    )
                    .with_for_update()
                )
            )
            .scalars()
            .first()
        )
        if previous_cash is None:
            raise ValueError("complete provider and cash balance context is required")
        cash_delta = Decimal("0")
        for item, _, _ in agent_items:
            if item.status != TransactionStatus.SUCCESS:
                continue
            cash_delta += (
                item.amount
                if item.transaction_type == TransactionType.CASH_IN
                else -item.amount
            )
        cash_source_at = max(
            _utc(previous_cash.source_timestamp),
            max(_utc(item.occurred_at) for item, _, _ in agent_items),
        )
        session.add(
            CashSnapshot(
                agent_id=agent_id,
                balance=previous_cash.balance + cash_delta,
                source_timestamp=cash_source_at,
                received_timestamp=received_at,
                quality_status=previous_cash.quality_status,
                quality_details={"derived_from_import_batch": True},
                scenario_run_id=run.id,
            )
        )

    await session.flush()
    for agent_id in by_agent:
        await recompute_agent(session, run, agent_id)
    await session.flush()
    await update_measured_results(session, run)
    add_audit(
        session,
        "transactions.imported",
        actor.id,
        "scenario_run",
        str(run.id),
        details={"accepted": len(accepted_items), "quarantined": quarantined},
    )
    await session.commit()
    return {
        "accepted": len(accepted_items),
        "quarantined": quarantined,
        "forecast_recalculation": "completed",
    }
