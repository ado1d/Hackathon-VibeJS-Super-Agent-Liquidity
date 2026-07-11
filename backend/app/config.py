from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Super Agent Platform"
    app_env: str = "demo"
    database_url: str = "sqlite+aiosqlite:///./super_agent.db"
    jwt_secret: str = "local-demo-secret-change-before-deployment"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost"]
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
    openai_model: str = "gpt-5.4-mini"
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
        return value.split(",") if isinstance(value, str) else value

    @field_validator("jwt_secret")
    @classmethod
    def safe_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET must contain at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
