"""Dependency-light integration smoke runner for constrained demo hosts."""
import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import Alert, Forecast
from app.services.scenarios import load_scenario


async def main() -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        run = await load_scenario(session, "B")
        types = set((await session.execute(select(Alert.alert_type).where(
            Alert.scenario_run_id == run.id))).scalars())
        assert {"shared_cash_liquidity", "repeated_near_identical"} <= types, types
        run = await load_scenario(session, "C")
        fallback = (await session.execute(select(func.count(Forecast.id)).where(
            Forecast.scenario_run_id == run.id, Forecast.reliable.is_(False)))).scalar_one()
        assert fallback >= 1
    await engine.dispose()
    print("backend smoke: scenarios B/C, alerts, and confidence fallback passed")


if __name__ == "__main__":
    asyncio.run(main())
