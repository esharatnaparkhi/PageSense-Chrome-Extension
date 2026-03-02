"""
Configuration settings for PageSense backend
"""
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_ENV: str = "development"
    # Defaults to False — must be explicitly set to True for local development.
    # Never enable in production.
    DEBUG: bool = False

    # Google OAuth
    GOOGLE_CLIENT_ID: str

    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # OpenAI API
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_MAX_TOKENS: int = 1024
    OPENAI_TEMPERATURE: float = 0.0

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "pagesense"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 86400

    # Vector Database (Qdrant)
    # URL must point to the private internal address in production
    # (e.g. http://qdrant.railway.internal:6333 on Railway).
    QDRANT_URL: str = "http://localhost:6333"
    # Required — must be a strong random value (64-char hex).
    # Generate with: python scripts/generate_qdrant_key.py
    # Set QDRANT__SERVICE__API_KEY to the same value on the Qdrant service.
    QDRANT_API_KEY: str
    QDRANT_COLLECTION_NAME: str = "pagesense_embeddings"

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    # Monitoring
    SENTRY_DSN: str = ""
    PROMETHEUS_PORT: int = 9090

    # Content Extraction
    MAX_PAGE_SIZE_MB: int = 10
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # Memory Configuration
    MAX_CHATS_PER_USER: int = 3
    MAX_QA_PER_CHAT_URL: int = 200

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        if not self.QDRANT_API_KEY:
            raise ValueError(
                "QDRANT_API_KEY must be set to a non-empty value. "
                "Generate one with: python scripts/generate_qdrant_key.py"
            )
        if len(self.QDRANT_API_KEY) < 32:
            raise ValueError(
                "QDRANT_API_KEY is too short — use a 64-character hex string."
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",          # silently ignore unknown env vars (e.g. DATABASE_URL leftovers)
    )


settings = Settings()
