"""
database.py — Kết nối PostgreSQL qua SQLAlchemy
"""
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings

ENV_FILE = Path(__file__).with_name(".env")


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:123@db:5432/DSS"

    class Config:
        env_file = str(ENV_FILE)


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
    if "can_ho" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("can_ho")}
    required_columns = {
        "ngay_het_han": "TIMESTAMP",
        "thumbnail_url": "TEXT",
        "thumbnail_path": "TEXT",
        "image_urls": "JSONB",
        "image_local_paths": "JSONB",
    }

    missing_columns = {
        name: ddl
        for name, ddl in required_columns.items()
        if name not in columns
    }

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            connection.execute(
                text(f"ALTER TABLE can_ho ADD COLUMN IF NOT EXISTS {column_name} {column_type}")
            )


# Dependency dùng trong FastAPI route
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
