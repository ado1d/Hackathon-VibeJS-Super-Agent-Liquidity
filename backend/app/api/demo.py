from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_session
from app.enums import Role
from app.models import ScenarioRun, User
from app.services.scenarios import SPECS

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/status")
async def demo_status(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict:
    active = (
        (
            await session.execute(
                select(ScenarioRun)
                .where(ScenarioRun.active.is_(True))
                .order_by(ScenarioRun.started_at.desc())
            )
        )
        .scalars()
        .first()
    )
    return {
        "active": active is not None,
        "scenario": None
        if active is None
        else {"code": active.code, "label": active.label, "seed": active.seed},
        "can_load": user.role == Role.ADMIN,
        "available_scenarios": [
            {"code": code, "label": SPECS[code].label} for code in ("A", "B", "C", "D")
        ]
        if user.role == Role.ADMIN
        else [],
    }
