import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agents, alerts, auth, health, metrics, users
from app.config import get_settings
from app.errors import AppError, app_error_handler, validation_error_handler

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("super-agent")

app = FastAPI(title=settings.app_name, version="1.0.0",
              description="Synthetic-data decision-support prototype")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    logger.info("request_complete method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
                request.method, request.url.path, response.status_code,
                (time.perf_counter() - started) * 1000, request_id)
    return response


for router in (health.router, auth.router, users.router, agents.router, alerts.router, metrics.router, admin.router):
    app.include_router(router, prefix="/api/v1")
