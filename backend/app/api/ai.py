"""Safe, role-scoped AI endpoints."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.alerts import scoped_alert
from app.api.deps import current_user, require_roles
from app.config import get_settings
from app.database import get_session
from app.enums import Role
from app.errors import AppError
from app.models import AIResponseCache, User
from app.services.ai import ai_is_enabled, run_ai_feature

router = APIRouter(tags=["ai"])


def require_ai() -> None:
    if not ai_is_enabled():
        raise AppError(
            "AI_DISABLED",
            "AI assistance is disabled. Core explainable workflows remain available.",
            503,
        )


@router.get("/ai/status")
async def ai_status(user: User = Depends(current_user)) -> dict:
    settings = get_settings()
    return {
        "enabled": ai_is_enabled(),
        "model": settings.openai_model if ai_is_enabled() else None,
        "features": ["translate", "summarize", "recommendations"] if ai_is_enabled() else [],
        "core_workflows_available": True,
    }


@router.post("/alerts/{alert_id}/translate")
async def translate_alert(
    alert_id: uuid.UUID,
    lang: Literal["bn", "banglish"] = Query(...),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    require_ai()
    alert = await scoped_alert(session, alert_id, user)
    return await run_ai_feature(session, alert, "translate", lang)


@router.post("/alerts/{alert_id}/summarize")
async def summarize_alert(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    require_ai()
    alert = await scoped_alert(session, alert_id, user)
    return await run_ai_feature(session, alert, "summarize")


@router.post("/alerts/{alert_id}/recommendations")
async def recommendations(
    alert_id: uuid.UUID,
    user: User = Depends(require_roles(Role.OPERATIONS, Role.RISK)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    require_ai()
    alert = await scoped_alert(session, alert_id, user)
    return await run_ai_feature(session, alert, "recommendations")


@router.get("/admin/ai-usage")
async def ai_usage(
    user: User = Depends(require_roles(Role.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    settings = get_settings()
    totals = (
        await session.execute(
            select(
                func.count(AIResponseCache.id),
                func.coalesce(func.sum(AIResponseCache.input_tokens), 0),
                func.coalesce(func.sum(AIResponseCache.output_tokens), 0),
                func.coalesce(func.sum(AIResponseCache.hit_count), 0),
            )
        )
    ).one()
    input_tokens, output_tokens = int(totals[1]), int(totals[2])
    estimated_cost = (
        input_tokens / 1_000_000 * settings.ai_input_cost_per_million
        + output_tokens / 1_000_000 * settings.ai_output_cost_per_million
    )
    return {
        "provider_calls": int(totals[0]),
        "cache_hits": int(totals[3]),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_cost": round(estimated_cost, 6),
        "currency": "USD",
        "pricing_version": settings.ai_pricing_version,
        "pricing_configured": settings.ai_pricing_version != "unconfigured",
    }
