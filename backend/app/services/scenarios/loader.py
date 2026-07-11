"""Scenario loading, reset, and agent recomputation."""

import uuid
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import FeedStatus, Role
from app.errors import AppError
from app.models import (
    Agent,
    AgentProviderBalance,
    Alert,
    AlertEvent,
    CashSnapshot,
    CaseNote,
    Forecast,
    IngestionQuarantine,
    Provider,
    ProviderFeedStatus,
    ScenarioRun,
    Transaction,
    User,
)
from app.security import hash_password
from app.services.audit import add_audit
from app.services.scenarios.calculator import calculate_and_alert
from app.services.scenarios.seed import build_transaction_rows, derive_balances
from app.services.scenarios.specs import ANCHOR, SPECS, ScenarioSpec


async def ensure_reference_data(session: AsyncSession) -> None:
    """Idempotently seed demo users, providers, and agents."""
    users = (await session.execute(select(User))).scalars().all()
    if not users:
        hashed = hash_password("demo-pass")
        users = [
            User(
                username=role.value,
                display_name=f"Demo {role.value.title()}",
                password_hash=hashed,
                role=role,
            )
            for role in Role
        ]
        session.add_all(users)
        await session.flush()

    by_role = {user.role: user for user in users}

    providers = (await session.execute(select(Provider).order_by(Provider.code))).scalars().all()
    if not providers:
        providers = [
            Provider(code="PROVIDER_A", display_name="Provider A", color="#dc2626"),
            Provider(code="PROVIDER_B", display_name="Provider B", color="#2563eb"),
        ]
        session.add_all(providers)

    agents = (await session.execute(select(Agent))).scalars().all()
    if not agents:
        session.add_all(
            [
                Agent(
                    code="AG-1001",
                    name="Rahman Store",
                    area="Dhaka North",
                    latitude=Decimal("23.810300"),
                    longitude=Decimal("90.412500"),
                    user_id=by_role[Role.AGENT].id,
                    assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                ),
                Agent(
                    code="AG-1002",
                    name="Mitali Telecom",
                    area="Dhaka North",
                    latitude=Decimal("23.814000"),
                    longitude=Decimal("90.418000"),
                    assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                ),
                Agent(
                    code="AG-1003",
                    name="Padma Services",
                    area="Dhaka South",
                    latitude=Decimal("23.735000"),
                    longitude=Decimal("90.395000"),
                    assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                ),
                Agent(
                    code="AG-1004",
                    name="Meghna Point",
                    area="Dhaka North",
                    latitude=Decimal("23.806000"),
                    longitude=Decimal("90.421000"),
                    assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                ),
            ]
        )
    await session.commit()


async def reset_operational_data(session: AsyncSession) -> None:
    """Delete current operational rows and deactivate prior runs.

    Historical run metadata and security audit logs are preserved.
    """
    for model in (
        AlertEvent,
        CaseNote,
        Alert,
        Forecast,
        ProviderFeedStatus,
        AgentProviderBalance,
        CashSnapshot,
        Transaction,
        IngestionQuarantine,
    ):
        await session.execute(delete(model))
    await session.execute(update(ScenarioRun).values(active=False))


async def recompute_agent(session: AsyncSession, run: ScenarioRun, agent_id: uuid.UUID) -> None:
    """Recalculate forecasts and alerts after an accepted transaction batch."""
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise AppError("AGENT_NOT_FOUND", "Imported transaction agent was not found.", 404)

    providers = list((await session.execute(select(Provider).order_by(Provider.code))).scalars())

    balances: list[Decimal] = []
    openings: list[Decimal] = []
    statuses: list[FeedStatus] = []
    for provider in providers:
        balance = (
            (
                await session.execute(
                    select(AgentProviderBalance)
                    .where(
                        AgentProviderBalance.agent_id == agent_id,
                        AgentProviderBalance.provider_id == provider.id,
                        AgentProviderBalance.scenario_run_id == run.id,
                    )
                    .order_by(AgentProviderBalance.source_timestamp.desc())
                )
            )
            .scalars()
            .first()
        )
        if balance is None:
            continue
        balances.append(balance.balance)
        openings.append(balance.balance)
        statuses.append(balance.quality_status)

    cash = (
        (
            await session.execute(
                select(CashSnapshot)
                .where(CashSnapshot.agent_id == agent_id, CashSnapshot.scenario_run_id == run.id)
                .order_by(CashSnapshot.source_timestamp.desc())
            )
        )
        .scalars()
        .first()
    )

    if len(balances) != len(providers) or cash is None:
        raise AppError(
            "INGESTION_BALANCE_CONTEXT_MISSING",
            "The imported agent does not have complete balance context.",
            409,
        )

    rows = list(
        (
            await session.execute(
                select(Transaction).where(
                    Transaction.agent_id == agent_id, Transaction.scenario_run_id == run.id
                )
            )
        ).scalars()
    )

    await session.execute(
        delete(Forecast).where(Forecast.agent_id == agent_id, Forecast.scenario_run_id == run.id)
    )

    provider_pair = (openings[0], openings[1])
    status_pair = (statuses[0], statuses[1])
    refresh_spec = ScenarioSpec(
        "refresh",
        run.label,
        run.seed,
        provider_pair,
        cash.balance,
        status_pair,
        run.expected_labels,
    )
    await calculate_and_alert(
        session, refresh_spec, run, agent, providers, rows, balances, cash.balance
    )


async def load_scenario(
    session: AsyncSession,
    code: str,
    actor_user_id: uuid.UUID | None = None,
    if_empty: bool = False,
) -> ScenarioRun:
    """Load a deterministic scenario by code (baseline, A, B, C, D)."""
    normalized = code.upper()
    if normalized not in SPECS:
        raise AppError("SCENARIO_NOT_FOUND", "Scenario must be baseline, A, B, C, or D.", 404)

    active = (
        (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True))))
        .scalars()
        .first()
    )
    if if_empty and active is not None:
        return active

    await ensure_reference_data(session)

    if session.bind and session.bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(20260711)"))

    await reset_operational_data(session)

    spec = SPECS[normalized]
    run = ScenarioRun(
        code=spec.code,
        label=spec.label,
        seed=spec.seed,
        expected_labels=spec.expected,
    )
    session.add(run)
    await session.flush()

    agent = (await session.execute(select(Agent).where(Agent.code == "AG-1001"))).scalar_one()
    providers = list(
        (await session.execute(select(Provider).order_by(Provider.code))).scalars().all()
    )

    rows = build_transaction_rows(spec, agent, providers, run)
    balances, cash = derive_balances(spec, rows, providers)
    session.add_all(rows)

    for idx, provider in enumerate(providers):
        status = spec.feed_statuses[idx]
        source_time = ANCHOR - (
            timedelta(minutes=30) if status == FeedStatus.MISSING else timedelta(minutes=2)
        )
        session.add(
            AgentProviderBalance(
                agent_id=agent.id,
                provider_id=provider.id,
                balance=balances[idx],
                source_timestamp=source_time,
                received_timestamp=ANCHOR,
                freshness_status=status,
                quality_status=status,
                quality_details={"scenario": spec.code},
                scenario_run_id=run.id,
            )
        )
        session.add(
            ProviderFeedStatus(
                agent_id=agent.id,
                provider_id=provider.id,
                status=status,
                last_received_at=source_time,
                missing_intervals=4 if status == FeedStatus.MISSING else 0,
                conflict_details=(
                    {"reported_difference_bdt": 7000} if status == FeedStatus.CONFLICTING else {}
                ),
                scenario_run_id=run.id,
            )
        )

    session.add(
        CashSnapshot(
            agent_id=agent.id,
            balance=cash,
            source_timestamp=ANCHOR,
            received_timestamp=ANCHOR,
            quality_status=FeedStatus.FRESH,
            scenario_run_id=run.id,
        )
    )

    await calculate_and_alert(session, spec, run, agent, providers, rows, balances, cash)
    await session.flush()

    alert_count = (
        await session.execute(select(func.count(Alert.id)).where(Alert.scenario_run_id == run.id))
    ).scalar_one()
    critical_count = (
        await session.execute(
            select(func.count(Alert.id)).where(
                Alert.scenario_run_id == run.id, Alert.severity == "critical"
            )
        )
    ).scalar_one()
    nearest_shortage = (
        await session.execute(
            select(func.min(Forecast.shortage_minutes)).where(
                Forecast.scenario_run_id == run.id, Forecast.shortage_minutes.is_not(None)
            )
        )
    ).scalar_one()

    run.measured_results = {
        "alert_count": alert_count,
        "critical_alert_count": critical_count,
        "nearest_shortage_minutes": float(nearest_shortage)
        if nearest_shortage is not None
        else None,
    }
    run.completed_at = ANCHOR

    add_audit(
        session,
        "scenario.loaded",
        actor_user_id,
        "scenario_run",
        str(run.id),
        details={"code": spec.code, "seed": spec.seed},
    )
    await session.commit()
    await session.refresh(run)
    return run
