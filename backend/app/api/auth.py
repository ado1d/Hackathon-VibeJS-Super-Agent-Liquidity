from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.errors import AppError
from app.models import User
from app.permissions import landing_path, permissions_for
from app.rate_limit import limiter, login_rate_limit_key
from app.schemas import LoginRequest, TokenResponse, UserView
from app.security import create_access_token, verify_password
from app.services.audit import add_audit

router = APIRouter(prefix="/auth", tags=["authentication"])


def _response(user: User) -> TokenResponse:
    token, expires = create_access_token(str(user.id), user.role.value)
    view = UserView.model_validate(user).model_copy(
        update={"permissions": permissions_for(user.role)}
    )
    return TokenResponse(
        access_token=token,
        expires_in=expires,
        user=view,
        landing_path=landing_path(user.role),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute", key_func=login_rate_limit_key)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
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
