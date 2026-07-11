import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.enums import Severity
from app.models import Alert, Forecast
from app.services.scenarios import load_scenario


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
async def test_scenarios_are_loadable(session, code: str) -> None:
    run = await load_scenario(session, code)
    assert run.code == code
    assert run.seed > 0


async def test_scenario_a_creates_provider_shortage(session) -> None:
    run = await load_scenario(session, "A")
    count = (
        await session.execute(
            select(func.count(Alert.id)).where(
                Alert.scenario_run_id == run.id, Alert.alert_type == "provider_liquidity"
            )
        )
    ).scalar_one()
    assert count >= 1


async def test_scenario_b_creates_cash_and_unusual_alerts(session) -> None:
    run = await load_scenario(session, "B")
    types = set(
        (
            await session.execute(select(Alert.alert_type).where(Alert.scenario_run_id == run.id))
        ).scalars()
    )
    assert "shared_cash_liquidity" in types
    assert "repeated_near_identical" in types


async def test_scenario_c_suppresses_precise_forecast(session) -> None:
    run = await load_scenario(session, "C")
    rows = (
        (
            await session.execute(
                select(Forecast).where(
                    Forecast.scenario_run_id == run.id, Forecast.resource_type == "provider_e_money"
                )
            )
        )
        .scalars()
        .all()
    )
    assert any(
        not row.reliable and row.shortage_minutes is None and row.severity == Severity.DATA_ISSUE
        for row in rows
    )
