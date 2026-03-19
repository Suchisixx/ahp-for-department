"""
schemas.py — Pydantic schemas: validate input/output API
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


# ─── CanHo ────────────────────────────────────────────────────────────────────

class CanHoBase(BaseModel):
    ma_tin:           str
    url:              Optional[str]  = None
    title:            Optional[str]  = None
    ngay_dang:        Optional[datetime] = None
    gia_ty:           Optional[float] = None
    gia_per_m2:       Optional[float] = None
    dien_tich:        Optional[float] = None
    so_phong_ngu:     Optional[int]  = None
    so_phong_wc:      Optional[int]  = None
    noi_that:         Optional[str]  = None
    du_an:            Optional[str]  = None
    phap_ly:          Optional[str]  = None
    tien_ich_ha_tang: Optional[str]  = None
    tien_ich_noi_khu: Optional[str]  = None
    huong_nha:        Optional[str]  = None
    huong_ban_cong:   Optional[str]  = None
    phuong:           Optional[str]  = None
    trang_thai:      Optional[bool]  = 1


class CanHoOut(CanHoBase):
    id: int

    model_config = {"from_attributes": True}


# ─── AHP Input ────────────────────────────────────────────────────────────────

class AhpRequest(BaseModel):
    ten_phien: str = "Phiên AHP"
    matrix: list[list[float]]          # 8×8

    @field_validator("matrix")
    @classmethod
    def validate_matrix(cls, v):
        if len(v) != 8:
            raise ValueError("Ma trận phải là 8×8")
        for row in v:
            if len(row) != 8:
                raise ValueError("Mỗi hàng phải có 8 phần tử")
            for val in row:
                if val <= 0:
                    raise ValueError("Tất cả giá trị phải > 0")
        return v


# ─── AHP Output ───────────────────────────────────────────────────────────────

class CriterionWeight(BaseModel):
    id:     str          # "C1"
    name:   str          # "Tài chính"
    weight: float
    pct:    float        # weight * 100


class ScoreDetail(BaseModel):
    C1: float; C2: float; C3: float; C4: float
    C5: float; C6: float; C7: float; C8: float


class RankedCanHo(BaseModel):
    rank:         int
    ahp_score:    float
    score_detail: dict[str, float]
    canho:        CanHoOut


class AhpResponse(BaseModel):
    session_id:   int
    ten_phien:    str
    cr:           float
    ci:           float
    lambda_max:   float
    cr_ok:        bool
    weights:      list[CriterionWeight]
    total_canho:  int
    ranked:       list[RankedCanHo]


# ─── Session history ──────────────────────────────────────────────────────────

class SessionSummary(BaseModel):
    id:         int
    ten_phien:  str
    cr:         float
    cr_ok:      bool
    created_at: datetime

    model_config = {"from_attributes": True}