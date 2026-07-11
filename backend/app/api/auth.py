from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.config import get_settings
from app.database import get_session
from app.errors import AppError
from app.models import User
from app.permissions import permissions_for
from app.schemas import LoginRequest, SwitchRoleRequest, TokenResponse, UserView
from app.security import create_access_token, verify_password
from app.services.audit import add_audit

router = APIRouter(prefix="/auth", tags=["authentication"])


def _response(user: User) -> TokenResponse:
    token, expires = create_access_token(str(user.id), user.role.value)
    view = UserView.model_validate(user).model_copy(
        update={"permissions": permissions_for(user.role)}
    )
    return TokenResponse(access_token=token, expires_in=expires, user=view)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, request: Request, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    user = (
        await session.execute(select(User).where(User.username == payload.username))
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppError("AUTH_INVALID_CREDENTIALS", "Username or password is incorrect.", 401)
    add_audit(
        session,
        "auth.login",
        user.id,
        "user",
        str(user.id),
        request.state.request_id,
        {"role": user.role.value},
    )
    await session.commit()
    return _response(user)


@router.post("/switch-role", response_model=TokenResponse)
async def switch_role(
    payload: SwitchRoleRequest,
    request: Request,
    actor: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    if get_settings().app_env != "demo":
        raise AppError(
            "AUTH_ROLE_SWITCH_DISABLED", "Role switching is only available in demo mode.", 403
        )
    target = (
        (
            await session.execute(
                select(User).where(User.role == payload.role, User.is_active.is_(True))
            )
        )
        .scalars()
        .first()
    )
    if target is None:
        raise AppError("AUTH_ROLE_UNAVAILABLE", "No active demo account exists for that role.", 404)
    add_audit(
        session,
        "auth.role_switched",
        actor.id,
        "user",
        str(target.id),
        request.state.request_id,
        {"from": actor.role.value, "to": target.role.value},
    )
    await session.commit()
    return _response(target)
