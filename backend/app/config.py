from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"  # "text" (human-readable) or "json" (for Loki)

    CORE_API_URL: str = "http://localhost:8000"
    SESSION_DURATION_DAYS: int = 7
    # Transcribe rate limits (per-session daily, per-IP daily, global daily)
    RATE_LIMIT_DAY: int = 20
    RATE_LIMIT_IP_DAY: int = 20
    RATE_LIMIT_GLOBAL_DAY: int = 1000

    # LLM rate limits - 10x transcribe limits (LLM calls are cheap on Groq)
    RATE_LIMIT_LLM_DAY: int = 200
    RATE_LIMIT_LLM_IP_DAY: int = 200
    RATE_LIMIT_LLM_GLOBAL_DAY: int = 10000

    DATABASE_URL: str = "sqlite:///./data/demo.db"

    # Demo content path (for pre-loaded demo entries)
    # Files expected: {DEMO_DATA_PATH}/en.json, sl.json, en.mp3, sl.mp3
    DEMO_DATA_PATH: str = "./data/demo"

    # CORS origins (comma-separated list)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env")

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
