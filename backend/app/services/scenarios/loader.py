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
from app.services.scenarios.specs import ANCHOR, SPECS

DEMO_PROVIDER_CODES = ("bkash", "nagad", "rocket")


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

    provider_defs = [
        ("bkash", "bKash", "#E2136E"),
        ("nagad", "Nagad", "#EC1C24"),
        ("rocket", "Rocket", "#7B2FF7"),
    ]
    providers = (await session.execute(select(Provider).order_by(Provider.code))).scalars().all()
    if not providers:
        providers = [
            Provider(code=code, display_name=name, color=color)
            for code, name, color in provider_defs
        ]
        session.add_all(providers)
        await session.flush()
    else:
        for idx, (code, name, color) in enumerate(provider_defs):
            if idx < len(providers):
                providers[idx].code = code
                providers[idx].display_name = name
                providers[idx].color = color
            else:
                session.add(Provider(code=code, display_name=name, color=color))
        await session.flush()

    agents = (await session.execute(select(Agent).order_by(Agent.code))).scalars().all()
    agent_defs = [
        ("AG-DHM-003", "Dhanmondi Mobile Point", "Dhanmondi", "23.746500", "90.376300", True),
        ("AG-MRP-014", "Mirpur Telecom Hub", "Mirpur", "23.804100", "90.366700", False),
        ("AG-UTR-021", "Uttara Cash & Wallet", "Uttara", "23.875900", "90.379500", False),
        ("AG-KWB-009", "Karwan Bazar Digital", "Karwan Bazar", "23.751600", "90.393600", False),
    ]
    if not agents:
        session.add_all(
            [
                Agent(
                    code=code,
                    name=name,
                    area=area,
                    latitude=Decimal(lat),
                    longitude=Decimal(lon),
                    user_id=by_role[Role.AGENT].id if is_agent else None,
                    assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                )
                for code, name, area, lat, lon, is_agent in agent_defs
            ]
        )
    else:
        for existing in agents:
            existing.user_id = None
            existing.assigned_operations_user_id = by_role[Role.OPERATIONS].id
        for idx, (code, name, area, lat, lon, is_agent) in enumerate(agent_defs):
            if idx < len(agents):
                agents[idx].code = code
                agents[idx].name = name
                agents[idx].area = area
                agents[idx].latitude = Decimal(lat)
                agents[idx].longitude = Decimal(lon)
                agents[idx].user_id = by_role[Role.AGENT].id if is_agent else None
                agents[idx].assigned_operations_user_id = by_role[Role.OPERATIONS].id
            else:
                session.add(
                    Agent(
                        code=code,
                        name=name,
                        area=area,
                        latitude=Decimal(lat),
                        longitude=Decimal(lon),
                        user_id=by_role[Role.AGENT].id if is_agent else None,
                        assigned_operations_user_id=by_role[Role.OPERATIONS].id,
                    )
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

    providers = list(
        (
            await session.execute(
                select(Provider)
                .where(Provider.code.in_(DEMO_PROVIDER_CODES))
                .order_by(Provider.code)
            )
        ).scalars()
    )

    balances: list[Decimal] = []
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
                    .order_by(
                        AgentProviderBalance.source_timestamp.desc(),
                        AgentProviderBalance.received_timestamp.desc(),
                        AgentProviderBalance.id.desc(),
                    )
                )
            )
            .scalars()
            .first()
        )
        if balance is None:
            continue
        balances.append(balance.balance)

    cash = (
        (
            await session.execute(
                select(CashSnapshot)
                .where(CashSnapshot.agent_id == agent_id, CashSnapshot.scenario_run_id == run.id)
                .order_by(
                    CashSnapshot.source_timestamp.desc(),
                    CashSnapshot.received_timestamp.desc(),
                    CashSnapshot.id.desc(),
                )
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

    spec = SPECS.get(run.code.upper())
    if spec is None:
        raise AppError(
            "SCENARIO_CONTRACT_MISSING",
            "The active scenario does not have a recomputation contract.",
            409,
        )
    await calculate_and_alert(session, spec, run, agent, providers, rows, balances, cash.balance)


async def update_measured_results(session: AsyncSession, run: ScenarioRun) -> None:
    """Refresh measured scenario outputs inside the caller's transaction."""
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
        "nearest_shortage_minutes": (
            float(nearest_shortage) if nearest_shortage is not None else None
        ),
    }


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

    await ensure_reference_data(session)

    active = (
        (await session.execute(select(ScenarioRun).where(ScenarioRun.active.is_(True))))
        .scalars()
        .first()
    )
    if if_empty and active is not None:
        return active

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

    agent = (
        await session.execute(
            select(Agent)
            .where(Agent.user_id.is_not(None))
            .order_by(Agent.code)
        )
    ).scalars().first()
    if agent is None:
        raise AppError("REFERENCE_AGENT_MISSING", "Demo agent reference data is missing.", 500)
    providers = list(
        (
            await session.execute(
                select(Provider)
                .where(Provider.code.in_(DEMO_PROVIDER_CODES))
                .order_by(Provider.code)
            )
        )
        .scalars()
        .all()
    )
    if len(providers) != len(SPECS["BASELINE"].provider_opening):
        raise AppError("REFERENCE_PROVIDER_MISSING", "Demo provider reference data is incomplete.", 500)

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

    support_agents = list(
        (
            await session.execute(
                select(Agent)
                .where(Agent.id != agent.id, Agent.active.is_(True))
                .order_by(Agent.code)
            )
        )
        .scalars()
        .all()
    )
    for support_idx, support_agent in enumerate(support_agents[:3], start=1):
        support_cash = spec.cash_opening + Decimal(12000 * support_idx)
        session.add(
            CashSnapshot(
                agent_id=support_agent.id,
                balance=support_cash,
                source_timestamp=ANCHOR,
                received_timestamp=ANCHOR,
                quality_status=FeedStatus.FRESH,
                scenario_run_id=run.id,
            )
        )
        for idx, provider in enumerate(providers):
            opening = spec.provider_opening[idx]
            balance = opening + Decimal(9000 * support_idx) + Decimal(2500 * idx)
            session.add(
                AgentProviderBalance(
                    agent_id=support_agent.id,
                    provider_id=provider.id,
                    balance=balance,
                    source_timestamp=ANCHOR,
                    received_timestamp=ANCHOR,
                    freshness_status=FeedStatus.FRESH,
                    quality_status=FeedStatus.FRESH,
                    quality_details={"scenario": spec.code, "support_agent": True},
                    scenario_run_id=run.id,
                )
            )
            session.add(
                ProviderFeedStatus(
                    agent_id=support_agent.id,
                    provider_id=provider.id,
                    status=FeedStatus.FRESH,
                    last_received_at=ANCHOR,
                    missing_intervals=0,
                    conflict_details={},
                    scenario_run_id=run.id,
                )
            )
    await session.flush()

    await update_measured_results(session, run)
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
