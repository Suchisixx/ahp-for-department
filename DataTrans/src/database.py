"""
database.py — Kết nối PostgreSQL qua SQLAlchemy
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:123@localhost:5432/DSS"

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


# Dependency dùng trong FastAPI route
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()