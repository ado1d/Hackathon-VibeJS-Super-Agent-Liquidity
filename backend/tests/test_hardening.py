from datetime import timedelta
from time import perf_counter

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.admin import import_transactions, set_iforest
from app.api.metrics import validation_payload
from app.database import Base
from app.enums import Role
from app.errors import AppError
from app.models import AgentProviderBalance, Alert, AlertEvent, CashSnapshot, User
from app.schemas import IsolationForestConfigRequest
from app.services.scenarios import ANCHOR, SPECS, load_scenario
from app.services.alerts import claim


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as value:
        yield value
    await engine.dispose()


@pytest.mark.parametrize("code", ["A", "B", "C", "D"])
async def test_scenario_anomaly_contracts_are_exact(session, code: str) -> None:
    run = await load_scenario(session, code)
    non_anomaly = {"provider_liquidity", "shared_cash_liquidity", "data_quality"}
    detected = set(
        (
            await session.execute(select(Alert.alert_type).where(Alert.scenario_run_id == run.id))
        ).scalars()
    ) - non_anomaly
    assert detected == set(SPECS[code].expected["expected_anomaly_types"])
    alerts = (
        (await session.execute(select(Alert).where(Alert.scenario_run_id == run.id)))
        .scalars()
        .all()
    )
    assert all(
        alert.reason
        and alert.evidence
        and alert.uncertainty_statement
        and alert.recommended_next_step
        for alert in alerts
    )
    assert all("confirmed fraud" not in alert.summary.lower() for alert in alerts)


async def test_validation_metrics_use_exact_set_definitions(session) -> None:
    await load_scenario(session, "B")
    payload = await validation_payload(session)
    assert payload["anomaly_detection_score"] == 1
    assert payload["anomaly_detection_coverage"] == 1
    assert payload["unexpected_anomaly_rate"] == 0
    assert "anomaly_precision" not in payload


async def test_scenario_recomputation_finishes_within_demo_budget(session) -> None:
    started = perf_counter()
    await load_scenario(session, "B")
    assert perf_counter() - started < 3


async def test_transaction_import_appends_snapshots_without_mutating_history(session) -> None:
    run = await load_scenario(session, "A")
    admin = (await session.execute(select(User).where(User.role == Role.ADMIN))).scalar_one()
    original_provider = (
        await session.execute(
            select(AgentProviderBalance).order_by(AgentProviderBalance.source_timestamp)
        )
    ).scalars().first()
    original_cash = (
        await session.execute(select(CashSnapshot).order_by(CashSnapshot.source_timestamp))
    ).scalars().first()
    assert original_provider is not None and original_cash is not None
    original_provider_value = original_provider.balance
    original_cash_value = original_cash.balance
    before_provider_count = (
        await session.execute(select(func.count(AgentProviderBalance.id)))
    ).scalar_one()
    before_cash_count = (await session.execute(select(func.count(CashSnapshot.id)))).scalar_one()

    result = await import_transactions(
        [
            {
                "external_event_id": "IMPORT-IMMUTABLE-1",
                "agent_code": "AG-1001",
                "provider_code": "PROVIDER_A",
                "transaction_type": "cash_out",
                "amount": "250.00",
                "status": "success",
                "synthetic_customer_id": "SYN-IMPORT-1",
                "occurred_at": (ANCHOR + timedelta(minutes=1)).isoformat(),
            }
        ],
        admin,
        session,
    )
    assert result["accepted"] == 1
    assert (await session.get(AgentProviderBalance, original_provider.id)).balance == original_provider_value
    assert (await session.get(CashSnapshot, original_cash.id)).balance == original_cash_value
    assert (
        await session.execute(select(func.count(AgentProviderBalance.id)))
    ).scalar_one() == before_provider_count + 1
    assert (await session.execute(select(func.count(CashSnapshot.id)))).scalar_one() == before_cash_count + 1
    assert run.measured_results["alert_count"] >= 1


async def test_isolation_forest_runtime_toggle_is_explicitly_not_persisted(session) -> None:
    await load_scenario(session, "A")
    admin = (await session.execute(select(User).where(User.role == Role.ADMIN))).scalar_one()
    response = await set_iforest(IsolationForestConfigRequest(enabled=False), admin, session)
    assert response == {"enabled": False, "persisted": False}


async def test_claim_is_idempotent_for_owner_and_rejects_another_claimant(session) -> None:
    run = await load_scenario(session, "B")
    alert = (
        await session.execute(select(Alert).where(Alert.scenario_run_id == run.id))
    ).scalars().first()
    operations = (
        await session.execute(select(User).where(User.role == Role.OPERATIONS))
    ).scalar_one()
    risk = (await session.execute(select(User).where(User.role == Role.RISK))).scalar_one()
    assert alert is not None
    await claim(session, alert, operations)
    await claim(session, alert, operations)
    with pytest.raises(AppError) as caught:
        await claim(session, alert, risk)
    assert caught.value.code == "ALERT_ALREADY_CLAIMED"
    event_count = (
        await session.execute(
            select(func.count(AlertEvent.id)).where(
                AlertEvent.alert_id == alert.id, AlertEvent.event_type == "owner_changed"
            )
        )
    ).scalar_one()
    assert event_count == 1
