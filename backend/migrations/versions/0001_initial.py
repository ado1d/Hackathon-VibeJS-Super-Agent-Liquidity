"""Create the immutable baseline PRD schema.

Revision ID: 0001

This migration deliberately declares every operation instead of importing live
ORM metadata. Existing databases stamped at 0001 remain compatible, while a
fresh database always receives the same historical schema.
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

role = sa.Enum("agent", "operations", "risk", "management", "admin", native_enum=False)
feed_status = sa.Enum("fresh", "delayed", "missing", "conflicting", native_enum=False)
severity = sa.Enum("critical", "high", "medium", "watch", "data_issue", native_enum=False)
alert_status = sa.Enum(
    "new", "acknowledged", "in_progress", "escalated", "resolved", "reopened",
    native_enum=False,
)
transaction_type = sa.Enum("cash_in", "cash_out", native_enum=False)
transaction_status = sa.Enum("success", "failed", "pending", native_enum=False)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "providers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("color", sa.String(20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "scenario_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("expected_labels", sa.JSON(), nullable=False),
        sa.Column("measured_results", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scenario_runs_code", "scenario_runs", ["code"])
    op.create_index("ix_scenario_runs_active", "scenario_runs", ["active"])

    op.create_table(
        "agents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("area", sa.String(120), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_operations_user_id", sa.Uuid(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_operations_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_agents_code", "agents", ["code"], unique=True)
    op.create_index("ix_agents_area", "agents", ["area"])

    op.create_table(
        "agent_provider_balances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("source_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("freshness_status", feed_status, nullable=False),
        sa.Column("quality_status", feed_status, nullable=False),
        sa.Column("quality_details", sa.JSON(), nullable=False),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_provider_balances_agent_id", "agent_provider_balances", ["agent_id"])
    op.create_index("ix_agent_provider_balances_provider_id", "agent_provider_balances", ["provider_id"])
    op.create_index(
        "ix_balance_agent_provider_time",
        "agent_provider_balances",
        ["agent_id", "provider_id", "source_timestamp"],
    )

    op.create_table(
        "cash_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("source_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quality_status", feed_status, nullable=False),
        sa.Column("quality_details", sa.JSON(), nullable=False),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cash_snapshots_agent_id", "cash_snapshots", ["agent_id"])
    op.create_index("ix_cash_agent_time", "cash_snapshots", ["agent_id", "source_timestamp"])

    op.create_table(
        "transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("external_event_id", sa.String(120), nullable=True),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_type", transaction_type, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", transaction_status, nullable=False),
        sa.Column("synthetic_customer_id", sa.String(120), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("validation_error", sa.Text(), nullable=True),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_event_id", name="uq_transaction_external_event"),
    )
    op.create_index("ix_transactions_agent_id", "transactions", ["agent_id"])
    op.create_index("ix_transactions_provider_id", "transactions", ["provider_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index("ix_transactions_synthetic_customer_id", "transactions", ["synthetic_customer_id"])
    op.create_index("ix_transactions_occurred_at", "transactions", ["occurred_at"])
    op.create_index("ix_transactions_scenario_run_id", "transactions", ["scenario_run_id"])
    op.create_index(
        "ix_tx_agent_provider_time", "transactions", ["agent_id", "provider_id", "occurred_at"]
    )

    op.create_table(
        "ingestion_quarantine",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("external_event_id", sa.String(120), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column("validation_reason", sa.Text(), nullable=False),
        sa.Column("quarantined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ingestion_quarantine_external_event_id", "ingestion_quarantine", ["external_event_id"])

    op.create_table(
        "provider_feed_status",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("status", feed_status, nullable=False),
        sa.Column("last_received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("missing_intervals", sa.Integer(), nullable=False),
        sa.Column("conflict_details", sa.JSON(), nullable=False),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agent_id", "provider_id", "scenario_run_id", name="uq_feed_run"),
    )
    op.create_index("ix_provider_feed_status_agent_id", "provider_feed_status", ["agent_id"])
    op.create_index("ix_provider_feed_status_provider_id", "provider_feed_status", ["provider_id"])

    op.create_table(
        "forecasts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=True),
        sa.Column("resource_type", sa.String(30), nullable=False),
        sa.Column("current_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("minimum_buffer", sa.Numeric(18, 2), nullable=False),
        sa.Column("net_consumption_per_minute", sa.Numeric(18, 4), nullable=False),
        sa.Column("shortage_minutes", sa.Numeric(12, 2), nullable=True),
        sa.Column("severity", severity, nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=False),
        sa.Column("confidence_reasons", sa.JSON(), nullable=False),
        sa.Column("contributing_factors", sa.JSON(), nullable=False),
        sa.Column("reliable", sa.Boolean(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_minutes", sa.Integer(), nullable=False),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_forecasts_agent_id", "forecasts", ["agent_id"])
    op.create_index(
        "ix_forecast_agent_resource", "forecasts", ["agent_id", "provider_id", "calculated_at"]
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=True),
        sa.Column("alert_type", sa.String(80), nullable=False),
        sa.Column("severity", severity, nullable=False),
        sa.Column("status", alert_status, nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=False),
        sa.Column("confidence_reasons", sa.JSON(), nullable=False),
        sa.Column("data_quality_status", feed_status, nullable=False),
        sa.Column("uncertainty_statement", sa.Text(), nullable=False),
        sa.Column("recommended_next_step", sa.Text(), nullable=False),
        sa.Column("assigned_role", role, nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_code", sa.String(80), nullable=True),
        sa.Column("scenario_run_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["scenario_run_id"], ["scenario_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_agent_id", "alerts", ["agent_id"])
    op.create_index("ix_alerts_alert_type", "alerts", ["alert_type"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_scenario_run_id", "alerts", ["scenario_run_id"])
    op.create_index("ix_alert_queue", "alerts", ["status", "severity", "created_at"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("from_status", sa.String(40), nullable=True),
        sa.Column("to_status", sa.String(40), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_events_alert_id", "alert_events", ["alert_id"])
    op.create_index("ix_alert_events_occurred_at", "alert_events", ["occurred_at"])

    op.create_table(
        "case_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=False),
        sa.Column("note_type", sa.String(40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_case_notes_alert_id", "case_notes", ["alert_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(60), nullable=True),
        sa.Column("entity_id", sa.String(80), nullable=True),
        sa.Column("request_id", sa.String(80), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_occurred_at", "audit_logs", ["occurred_at"])


def downgrade() -> None:
    for table in (
        "audit_logs",
        "case_notes",
        "alert_events",
        "alerts",
        "forecasts",
        "provider_feed_status",
        "ingestion_quarantine",
        "transactions",
        "cash_snapshots",
        "agent_provider_balances",
        "agents",
        "scenario_runs",
        "providers",
        "users",
    ):
        op.drop_table(table)
