from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.rate_limit import limiter

router = APIRouter(tags=["health"])


@router.get("/health")
@limiter.exempt
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
@limiter.exempt
async def ready(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ready", "database": "reachable"}
