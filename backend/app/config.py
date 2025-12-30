from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    CORE_API_URL: str = "http://localhost:8000"
    SESSION_DURATION_DAYS: int = 7
    # Transcribe rate limits (per-session hourly/daily, per-IP daily, global daily)
    RATE_LIMIT_HOUR: int = 5
    RATE_LIMIT_DAY: int = 20
    RATE_LIMIT_IP_DAY: int = 20
    RATE_LIMIT_GLOBAL_DAY: int = 1000

    # LLM rate limits - 10x transcribe limits (LLM calls are cheap on Groq)
    RATE_LIMIT_LLM_HOUR: int = 50
    RATE_LIMIT_LLM_DAY: int = 200
    RATE_LIMIT_LLM_IP_DAY: int = 200
    RATE_LIMIT_LLM_GLOBAL_DAY: int = 10000

    DATABASE_URL: str = "sqlite:///./data/demo.db"

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
