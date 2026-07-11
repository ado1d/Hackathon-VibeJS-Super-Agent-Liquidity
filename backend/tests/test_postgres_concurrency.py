"""Opt-in PostgreSQL locking tests.

Set RUN_POSTGRES_CONCURRENCY_TESTS=1 and TEST_DATABASE_URL to a disposable
database whose name contains ``test``. These tests intentionally recreate its
schema and are not run against SQLite.
"""

import asyncio
import os

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.enums import Role
from app.errors import AppError
from app.models import Alert, AlertEvent, ScenarioRun, User
from app.services.alerts import claim
from app.services.scenarios import load_scenario

DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
ENABLED = os.getenv("RUN_POSTGRES_CONCURRENCY_TESTS") == "1"
pytestmark = pytest.mark.skipif(
    not ENABLED or not DATABASE_URL.startswith("postgresql") or "test" not in DATABASE_URL.lower(),
    reason="Requires an explicitly enabled disposable PostgreSQL test database.",
)


@pytest.fixture
async def pg_factory():
    engine = create_async_engine(DATABASE_URL, pool_size=5)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


async def test_concurrent_scenario_loads_serialize(pg_factory) -> None:
    async with pg_factory() as session:
        await load_scenario(session, "BASELINE")

    async def load(code: str) -> None:
        async with pg_factory() as session:
            await load_scenario(session, code)

    await asyncio.gather(load("A"), load("B"))
    async with pg_factory() as session:
        active = (
            await session.execute(
                select(func.count(ScenarioRun.id)).where(ScenarioRun.active.is_(True))
            )
        ).scalar_one()
        assert active == 1


async def test_claims_are_atomic_and_same_owner_is_idempotent(pg_factory) -> None:
    async with pg_factory() as session:
        run = await load_scenario(session, "D")
        alert_id = (
            await session.execute(select(Alert.id).where(Alert.scenario_run_id == run.id))
        ).scalars().first()
        operations_id = (
            await session.execute(select(User.id).where(User.role == Role.OPERATIONS))
        ).scalar_one()
        risk_id = (await session.execute(select(User.id).where(User.role == Role.RISK))).scalar_one()

    async def attempt(user_id):
        async with pg_factory() as session:
            alert = await session.get(Alert, alert_id)
            actor = await session.get(User, user_id)
            try:
                await claim(session, alert, actor)
                return "claimed"
            except AppError as exc:
                return exc.code

    results = await asyncio.gather(attempt(operations_id), attempt(risk_id))
    assert sorted(results) == ["ALERT_ALREADY_CLAIMED", "claimed"]
    winner_id = operations_id if results[0] == "claimed" else risk_id
    assert await asyncio.gather(attempt(winner_id), attempt(winner_id)) == ["claimed", "claimed"]

    async with pg_factory() as session:
        owner_events = (
            await session.execute(
                select(func.count(AlertEvent.id)).where(
                    AlertEvent.alert_id == alert_id, AlertEvent.event_type == "owner_changed"
                )
            )
        ).scalar_one()
        assert owner_events == 1
