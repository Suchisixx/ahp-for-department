"""
database.py — Kết nối PostgreSQL qua SQLAlchemy
"""
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings

ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:123@db:5432/DSS"
    OPENROUTER_API_KEY: str 
    # OPENROUTER_DEFAULT_MODEL: str = "qwen/qwen3-next-80b-a3b-instruct:free"
    OPENROUTER_DEFAULT_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_FALLBACK_MODELS: str = (
        "z-ai/glm-4.5-air:free,"
        "stepfun/step-3.5-flash:free,"
        "meta-llama/llama-3.3-70b-instruct:free,"
        "nvidia/nemotron-3-nano-30b-a3b:free"
    )
    OPENROUTER_TIMEOUT_SECONDS: int = 45
    OPENROUTER_SITE_URL: str = ""
    OPENROUTER_APP_NAME: str = "ApartmentBroker DSS"

    class Config:
      env_file = ".env"


settings = Settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # kiểm tra kết nối trước khi dùng
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_canho_schema():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    table_requirements = {
        "can_ho": {
            "ngay_het_han": "TIMESTAMP",
            "thumbnail_url": "TEXT",
            "thumbnail_path": "TEXT",
            "image_urls": "JSONB",
            "image_local_paths": "JSONB",
        },
        "ahp_session": {
            "llm_model": "TEXT",
            "llm_status": "VARCHAR(20)",
            "llm_output": "JSONB",
            "llm_error": "TEXT",
            "llm_generated_at": "TIMESTAMP",
        },
    }

    for table_name, required_columns in table_requirements.items():
        if table_name not in table_names:
            continue

        columns = {column["name"] for column in inspector.get_columns(table_name)}
        missing_columns = {
            name: ddl
            for name, ddl in required_columns.items()
            if name not in columns
        }

        if not missing_columns:
            continue

        with engine.begin() as connection:
            for column_name, column_type in missing_columns.items():
                connection.execute(
                    text(
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                    )
                )


# Dependency dùng trong FastAPI route
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
