from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


def normalize_database_url(url: str) -> str:
    """Normalize the database URL to use the async psycopg3 driver.

    Render's ``fromDatabase: property: connectionString`` injects
    ``DATABASE_URL`` as ``postgres://user:pass@host:port/db`` (standard libpq
    format). SQLAlchemy interprets the bare ``postgres://`` scheme as the
    legacy psycopg2 driver, which is not installed — only ``psycopg[binary]``
    (psycopg3) is. This rewriter ensures any of these inputs work:

      postgres://...            -> postgresql+psycopg://...
      postgresql://...          -> postgresql+psycopg://...
      postgresql+psycopg2://... -> postgresql+psycopg://...
      postgresql+psycopg://...  -> unchanged
      sqlite+aiosqlite://...    -> unchanged
    """
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql+psycopg://" + url[len("postgresql+psycopg2://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(normalize_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
