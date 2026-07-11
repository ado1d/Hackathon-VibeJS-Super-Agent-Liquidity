"""Add safe structured AI response cache.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_response_cache",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("feature", sa.String(length=40), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("prompt_version", sa.String(length=40), nullable=False),
        sa.Column("response_payload", sa.JSON(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("openai_request_id", sa.String(length=120), nullable=True),
        sa.Column("safety_status", sa.String(length=40), nullable=False),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cache_key"),
    )
    op.create_index("ix_ai_response_cache_alert_id", "ai_response_cache", ["alert_id"])
    op.create_index("ix_ai_response_cache_cache_key", "ai_response_cache", ["cache_key"])
    op.create_index("ix_ai_response_cache_expires_at", "ai_response_cache", ["expires_at"])
    op.create_index("ix_ai_response_cache_feature", "ai_response_cache", ["feature"])


def downgrade() -> None:
    op.drop_index("ix_ai_response_cache_feature", table_name="ai_response_cache")
    op.drop_index("ix_ai_response_cache_expires_at", table_name="ai_response_cache")
    op.drop_index("ix_ai_response_cache_cache_key", table_name="ai_response_cache")
    op.drop_index("ix_ai_response_cache_alert_id", table_name="ai_response_cache")
    op.drop_table("ai_response_cache")
