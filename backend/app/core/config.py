"""Application configuration, loaded from environment variables / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "Study Library Management System"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:9999"]

    # --- Postgres ---
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5444
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "12345"
    POSTGRES_DB: str = "study-library"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # --- Redis ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # --- JWT ---
    JWT_SECRET_KEY: str = "change-me-in-production-this-is-a-dev-only-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Static files (QR codes) ---
    STATIC_ROOT: str = "static"
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    FRONTEND_BASE_URL: str = "http://localhost:9999"

    # --- Groq AI Assistant ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # --- Scheduler ---
    EXPIRY_REMINDER_DAYS_BEFORE: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()
