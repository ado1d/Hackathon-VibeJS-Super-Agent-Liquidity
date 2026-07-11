from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Super Agent Platform"
    app_env: str = "demo"
    database_url: str = "sqlite+aiosqlite:///./super_agent.db"
    jwt_secret: str = "local-demo-secret-change-before-deployment"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    # NoDecode tells pydantic-settings to skip JSON parsing and hand the raw
    # env string to the field_validator below, which splits on commas.
    # This lets users set CORS_ORIGINS="https://a.com,https://b.com" or "*"
    # without wrapping it in a JSON array.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://localhost"]
    demo_seed: int = 20260711
    short_window_minutes: int = 15
    medium_window_minutes: int = 60
    forecast_horizon_minutes: int = 360
    provider_min_buffer_bdt: float = 5000
    cash_min_buffer_bdt: float = 10000
    fresh_after_minutes: int = 5
    missing_after_minutes: int = 15
    anomaly_config_path: str = "app/services/anomaly_thresholds.yaml"
    enable_isolation_forest: bool = True
    rate_limit_enabled: bool = True
    rate_limit_storage_uri: str = "memory://"
    rate_limit_trust_proxy_headers: bool = True
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    ai_enabled: bool = False
    ai_max_output_tokens: int = 500
    ai_timeout_seconds: float = 12
    ai_cache_ttl_minutes: int = 60
    ai_input_cost_per_million: float = 0
    ai_output_cost_per_million: float = 0
    ai_pricing_version: str = "unconfigured"
    validation_data_dir: Path = Path("../data/validation")
    commit_identifier: str = "unknown"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        # Accept either a JSON array string ("[\"https://a.com\"]") or a
        # plain comma-separated string ("https://a.com,https://b.com").
        # Also accept a literal "*" to allow all origins.
        if isinstance(value, str):
            value = value.strip()
            if value == "*":
                return ["*"]
            if value.startswith("["):
                import json
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("jwt_secret")
    @classmethod
    def safe_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET must contain at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
