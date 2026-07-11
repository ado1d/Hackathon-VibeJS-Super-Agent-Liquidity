from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.database import Base, normalize_database_url
from app import models  # noqa: F401

config = context.config
database_url = get_settings().database_url

# Normalize whatever DATABASE_URL the platform injects.
# Render's `fromDatabase: property: connectionString` outputs `postgres://...`,
# which SQLAlchemy would interpret as the legacy psycopg2 driver (not
# installed). The normalizer rewrites it to `postgresql+psycopg://...` so
# Alembic uses the installed psycopg3 driver.
database_url = normalize_database_url(database_url)

# The application uses an async SQLite driver in tests, while Alembic's
# migration runner is synchronous. PostgreSQL's psycopg URL works in both.
migration_url = database_url.replace("sqlite+aiosqlite://", "sqlite://")
config.set_main_option("sqlalchemy.url", migration_url)
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata,
                      literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}),
                                     prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_offline() if context.is_offline_mode() else run_migrations_online()
