import uuid
from collections.abc import Awaitable, Callable

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.enums import Role
from app.errors import AppError
from app.models import User
from app.permissions import has_permission
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise AppError("AUTH_REQUIRED", "Authentication is required.", 401)
    try:
        payload = decode_access_token(credentials.credentials)
        user = await session.get(User, uuid.UUID(payload["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise AppError(
            "AUTH_INVALID_TOKEN", "The access token is invalid or expired.", 401
        ) from None
    if user is None or not user.is_active:
        raise AppError("AUTH_USER_INACTIVE", "The demo user is unavailable.", 401)
    return user


def require_roles(*roles: Role) -> Callable[..., Awaitable[User]]:
    """Dependency that allows access iff the user's role is in ``roles``.

    ADMIN is always allowed. Use this for endpoints whose access policy is
    naturally expressed as "these specific roles" (e.g. only Operations and
    Risk can resolve alerts).
    """

    async def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles and user.role != Role.ADMIN:
            raise AppError("AUTH_FORBIDDEN", "Your role cannot perform this action.", 403)
        return user

    return dependency


def require_permission(permission: str) -> Callable[..., Awaitable[User]]:
    """Dependency that allows access iff the user's role grants ``permission``.

    Consults ``app.permissions.PERMISSIONS`` so the server-side check and the
    frontend ``user.permissions`` list stay in sync. ADMIN matches any
    permission via the ``"*"`` wildcard. Prefer this over ``require_roles``
    for new endpoints.
    """

    async def dependency(user: User = Depends(current_user)) -> User:
        if not has_permission(user.role, permission):
            raise AppError(
                "AUTH_FORBIDDEN",
                f"Your role does not grant the {permission!r} permission.",
                403,
            )
        return user

    return dependency
