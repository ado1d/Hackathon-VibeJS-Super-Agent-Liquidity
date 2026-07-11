"""Application-wide SlowAPI policy and standard error response."""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.security import decode_access_token


def client_ip(request: Request) -> str:
    settings = get_settings()
    if settings.rate_limit_trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    return get_remote_address(request) or "unknown"


def login_rate_limit_key(request: Request) -> str:
    return f"ip:{client_ip(request)}"


def rate_limit_key(request: Request) -> str:
    """Use an authenticated JWT subject, falling back to the remote IP."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            subject = decode_access_token(token).get("sub")
            if subject:
                return f"subject:{subject}"
        except Exception:  # Invalid tokens are handled by the auth dependency.
            pass
    return login_rate_limit_key(request)


settings = get_settings()
limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["50/minute"],
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
    headers_enabled=True,
)


async def rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RateLimitExceeded):
        raise exc
    request_id = getattr(request.state, "request_id", "unknown")
    retry_after = "60"
    headers: dict[str, Any] = getattr(exc, "headers", {}) or {}
    retry_after = str(headers.get("Retry-After", retry_after))
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": retry_after, "X-Request-ID": request_id},
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Retry after the indicated delay.",
                "details": {"retry_after_seconds": int(retry_after)},
                "request_id": request_id,
            }
        },
    )
