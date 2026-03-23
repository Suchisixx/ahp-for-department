"""
models.py — ORM models ánh xạ 3 bảng PostgreSQL
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, SmallInteger, String, Text,
    Numeric, Boolean, DateTime, ForeignKey
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class CanHo(Base):
    __tablename__ = "can_ho"

    id               = Column(Integer, primary_key=True, index=True)
    ma_tin           = Column(String(20), unique=True, nullable=False)
    url              = Column(Text)
    title            = Column(Text)
    ngay_dang        = Column(DateTime)
    ngay_het_han     = Column(DateTime)
    thumbnail_url    = Column(Text)
    thumbnail_path   = Column(Text)
    image_urls       = Column(JSONB)
    image_local_paths = Column(JSONB)

    # C1
    gia_ty           = Column(Numeric(10, 3))
    gia_per_m2       = Column(Numeric(10, 3))
    dien_tich        = Column(Numeric(8, 2))

    # C2
    so_phong_ngu     = Column(SmallInteger)
    so_phong_wc      = Column(SmallInteger)
    noi_that         = Column(String(30))

    # C3
    du_an            = Column(String(200))

    # C4
    phap_ly          = Column(String(60))

    # C5
    tien_ich_ha_tang = Column(Text)

    # C6
    tien_ich_noi_khu = Column(Text)

    # C7+C8
    huong_nha        = Column(String(20))
    huong_ban_cong   = Column(String(20))

    # Meta
    phuong           = Column(String(100))
    created_at       = Column(DateTime, default=datetime.now)
    updated_at       = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    trang_thai       = Column(Boolean, default=1)  # 1: active, 0: inactive (bán rồi, rút tin,...)

    # Relationship
    results = relationship("AhpResult", back_populates="canho", cascade="all, delete")


class AhpSession(Base):
    __tablename__ = "ahp_session"

    id          = Column(Integer, primary_key=True, index=True)
    ten_phien   = Column(String(100), default="Phiên AHP")
    ma_tran     = Column(JSONB, nullable=False)
    weights     = Column(JSONB, nullable=False)
    lambda_max  = Column(Numeric(10, 6))
    ci          = Column(Numeric(10, 6))
    cr          = Column(Numeric(10, 6))
    cr_ok       = Column(Boolean, nullable=False)
    llm_model   = Column(Text)
    llm_status  = Column(String(20))
    llm_output  = Column(JSONB)
    llm_error   = Column(Text)
    llm_generated_at = Column(DateTime)
    created_at  = Column(DateTime, default=datetime.now)

    results = relationship("AhpResult", back_populates="session", cascade="all, delete")


class AhpResult(Base):
    __tablename__ = "ahp_result"

    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(Integer, ForeignKey("ahp_session.id", ondelete="CASCADE"))
    canho_id     = Column(Integer, ForeignKey("can_ho.id",      ondelete="CASCADE"))
    ahp_score    = Column(Numeric(8, 4), nullable=False)
    rank         = Column(SmallInteger, nullable=False)
    score_detail = Column(JSONB)
    created_at   = Column(DateTime, default=datetime.now)

    session = relationship("AhpSession", back_populates="results")
    canho   = relationship("CanHo",      back_populates="results")
