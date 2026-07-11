import json
from pathlib import Path

import yaml

from app.config import Settings

ROOT = Path(__file__).resolve().parents[2]


def _env(service: dict) -> dict[str, dict]:
    return {item["key"]: item for item in service["envVars"]}


def test_render_blueprint_enables_structured_ai_without_committing_secret() -> None:
    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    services = {service["name"]: service for service in blueprint["services"]}
    backend = services["super-agent-backend"]
    frontend = services["super-agent-frontend"]
    backend_env = _env(backend)

    assert backend["branch"] == "vercel-openai-zip-implementation"
    assert backend["healthCheckPath"] == "/api/v1/health"
    assert backend_env["AI_ENABLED"]["value"] == "true"
    assert backend_env["OPENAI_MODEL"]["value"] == "gpt-5.4-mini"
    assert backend_env["OPENAI_API_KEY"] == {"key": "OPENAI_API_KEY", "sync": False}
    assert frontend["healthCheckPath"] == "/healthz"
    assert _env(frontend)["BACKEND_URL"]["value"] == "https://placeholder.invalid"


def test_render_containers_honor_dynamic_port_and_safe_nginx_substitution() -> None:
    backend_dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
    frontend_dockerfile = (ROOT / "frontend" / "Dockerfile").read_text(encoding="utf-8")
    entrypoint = (ROOT / "frontend" / "docker-entrypoint.sh").read_text(encoding="utf-8")
    nginx_template = (ROOT / "frontend" / "nginx.conf.template").read_text(encoding="utf-8")

    assert "${PORT:-8000}" in backend_dockerfile
    assert "COPY --chmod=755 docker-entrypoint.sh" in frontend_dockerfile
    assert "RUN chmod" not in frontend_dockerfile
    assert 'ENTRYPOINT ["/usr/local/bin/super-agent-entrypoint"]' in frontend_dockerfile
    assert "envsubst '${BACKEND_URL} ${BACKEND_HOST} ${PORT}'" in entrypoint
    assert "proxy_set_header Host ${BACKEND_HOST};" in nginx_template
    assert "proxy_ssl_name ${BACKEND_HOST};" in nginx_template
    assert "proxy_pass $backend_url$request_uri;" in nginx_template


def test_default_openai_model_matches_render_model() -> None:
    assert Settings(_env_file=None).openai_model == "gpt-5.4-mini"


def test_vercel_frontend_deploy_is_static_and_keeps_openai_server_side() -> None:
    vercel = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    vercel_ignore = (ROOT / ".vercelignore").read_text(encoding="utf-8")
    docs = (ROOT / "docs" / "vercel-deployment.md").read_text(encoding="utf-8")

    assert vercel["framework"] == "vite"
    assert vercel["installCommand"] == "cd frontend && npm ci"
    assert vercel["buildCommand"] == "cd frontend && npm run build"
    assert vercel["outputDirectory"] == "frontend/dist"
    assert vercel["rewrites"] == [{"source": "/(.*)", "destination": "/index.html"}]
    assert "backend/tests/" in vercel_ignore
    assert "Do not add `OPENAI_API_KEY` to the Vercel frontend project." in docs
    assert "VITE_API_BASE=https://<backend-host>/api/v1" in docs
