"""
routers/canho.py
GET /canho/list  — danh sách căn hộ với filter + phân trang
GET /canho/{id}  — chi tiết 1 căn hộ
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from media_resolver import attach_media_sources
from models import CanHo
from schema import CanHoOut

router = APIRouter(prefix="/canho", tags=["Căn hộ"])


@router.get("/list", response_model=list[CanHoOut])
def get_list(
    # Phân trang
    skip:      int   = Query(0,   ge=0),
    limit:     int   = Query(50,  ge=1, le=200),
    # Filter
    gia_min:   float = Query(None, description="Giá từ (tỷ)"),
    gia_max:   float = Query(None, description="Giá đến (tỷ)"),
    dt_min:    float = Query(None, description="Diện tích từ (m²)"),
    dt_max:    float = Query(None, description="Diện tích đến (m²)"),
    pn:        int   = Query(None, description="Số phòng ngủ tối thiểu"),
    noi_that:  str   = Query(None, description="Nội thất: Cao cấp/Đầy đủ/Cơ bản/Không có"),
    phap_ly:   str   = Query(None, description="Pháp lý: so/hop-dong/chua"),
    q:         str   = Query(None, description="Tìm theo tên dự án hoặc tiêu đề"),
    db: Session = Depends(get_db),
):
    qs = db.query(CanHo).filter(CanHo.trang_thai.is_(True))

    if gia_min is not None:
        qs = qs.filter(CanHo.gia_ty >= gia_min)
    if gia_max is not None:
        qs = qs.filter(CanHo.gia_ty <= gia_max)
    if dt_min is not None:
        qs = qs.filter(CanHo.dien_tich >= dt_min)
    if dt_max is not None:
        qs = qs.filter(CanHo.dien_tich <= dt_max)
    if pn is not None:
        qs = qs.filter(CanHo.so_phong_ngu >= pn)
    if noi_that:
        qs = qs.filter(CanHo.noi_that.ilike(f"%{noi_that}%"))
    if phap_ly == "so":
        qs = qs.filter(
            or_(CanHo.phap_ly.ilike("%sổ đỏ%"), CanHo.phap_ly.ilike("%sổ hồng%"))
        )
    elif phap_ly == "hop-dong":
        qs = qs.filter(CanHo.phap_ly.ilike("%hợp đồng%"))
    elif phap_ly == "chua":
        qs = qs.filter(CanHo.phap_ly.ilike("%chưa%"))
    if q:
        qs = qs.filter(
            or_(CanHo.title.ilike(f"%{q}%"), CanHo.du_an.ilike(f"%{q}%"))
        )

    return [attach_media_sources(ch) for ch in qs.offset(skip).limit(limit).all()]


@router.get("/{canho_id}", response_model=CanHoOut)
def get_one(canho_id: int, db: Session = Depends(get_db)):
    ch = (
        db.query(CanHo)
        .filter(CanHo.id == canho_id, CanHo.trang_thai.is_(True))
        .first()
    )
    if not ch:
        raise HTTPException(status_code=404, detail="Không tìm thấy căn hộ")
    return attach_media_sources(ch)
