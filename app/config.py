"""Application configuration loaded from .env"""
from pydantic_settings import BaseSettings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "vmc_roads"
    secret_key: str = "vmc-roads-secret-key-2024"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    app_env: str = "development"
    mapillary_token: str = ""

    model_config = {"env_file": str(ROOT / ".env"), "extra": "ignore"}


settings = Settings()
