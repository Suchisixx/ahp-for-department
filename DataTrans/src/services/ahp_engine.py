"""
services/ahp_engine.py
══════════════════════════════════════════════════════════
Thuật toán AHP thuần Python + NumPy:
  1. calc_weights(matrix)   → weights, CR, CI, lambda_max
  2. score_canho(ch, weights) → điểm tổng hợp + chi tiết 8 tiêu chí
══════════════════════════════════════════════════════════
"""
import numpy as np
from typing import Any

# Bảng chỉ số ngẫu nhiên Saaty
RI_TABLE = {1:0.00, 2:0.00, 3:0.58, 4:0.90, 5:1.12,
            6:1.24, 7:1.32, 8:1.41, 9:1.45, 10:1.49}

CRITERIA = [
    {"id": "C1", "name": "Tài chính"},
    {"id": "C2", "name": "Nội thất"},
    {"id": "C3", "name": "Chủ đầu tư"},
    {"id": "C4", "name": "Pháp lý"},
    {"id": "C5", "name": "Hạ tầng XH"},
    {"id": "C6", "name": "Tiện ích NK"},
    {"id": "C7", "name": "Ngoại thất"},
    {"id": "C8", "name": "Phong thủy"},
]


# ──────────────────────────────────────────────────────────
# B1: Tính trọng số và kiểm tra nhất quán
# ──────────────────────────────────────────────────────────
def calc_weights(matrix: list[list[float]]) -> dict:
    """
    Nhận ma trận so sánh cặp NxN (N=8),
    trả về: weights (list), lambda_max, ci, cr, cr_ok.
    """
    A = np.array(matrix, dtype=float)
    n = A.shape[0]

    # Chuẩn hoá: chia mỗi ô cho tổng cột
    col_sum = A.sum(axis=0)
    norm = A / col_sum

    # Trọng số = trung bình từng hàng
    weights = norm.mean(axis=1)

    # Tính lambda_max
    Aw = A @ weights
    consistency_vec = Aw / weights
    lambda_max = float(consistency_vec.mean())

    # CI và CR
    ci = (lambda_max - n) / (n - 1)
    ri = RI_TABLE.get(n, 1.49)
    cr = ci / ri if ri > 0 else 0.0

    return {
        "weights":    [round(float(w), 6) for w in weights],
        "lambda_max": round(lambda_max, 6),
        "ci":         round(float(ci), 6),
        "cr":         round(float(cr), 6),
        "cr_ok":      bool(cr < 0.10),
    }


# ──────────────────────────────────────────────────────────
# B2: Hàm chấm điểm từng tiêu chí (0.0 – 1.0)
# ──────────────────────────────────────────────────────────

def _s_gia(v) -> float:
    """C1: Giá thấp = tốt (nghịch chiều)."""
    if not v:
        return 0.5
    x = float(v)
    if x <= 2.0:  return 1.00
    if x <= 3.5:  return 0.90
    if x <= 5.0:  return 0.78
    if x <= 7.0:  return 0.62
    if x <= 10.0: return 0.45
    if x <= 15.0: return 0.28
    return 0.12


def _s_noi_that(v) -> float:
    """C2: Chất lượng nội thất."""
    MAP = {
        "cao cấp": 1.00, "cao cap": 1.00,
        "đầy đủ":  0.85, "day du":  0.85, "full": 0.85,
        "cơ bản":  0.55, "co ban":  0.55,
        "không có": 0.20, "khong co": 0.20,
    }
    key = (v or "").lower().strip().rstrip(":")
    return MAP.get(key, 0.50)


def _s_du_an(v) -> float:
    """C3: Thương hiệu chủ đầu tư / dự án."""
    if not v or v.lower() in ("không thuộc dự án", "khong thuoc du an"):
        return 0.30
    BIG = r"vinhomes|masterise|phú mỹ hưng|scenic|sky garden|origami|" \
          r"marq|celesta|green valley|celadon|diamond|urban hill|the era|hung vuong"
    import re
    return 1.00 if re.search(BIG, v, re.I) else 0.70


def _s_phap_ly(v) -> float:
    """C4: Loại giấy tờ pháp lý."""
    s = (v or "").lower()
    if "sổ đỏ" in s or "sổ hồng" in s:
        return 1.00
    if "giấy tờ hợp lệ" in s:
        return 0.75
    if "hợp đồng" in s:
        return 0.55
    if "chưa" in s:
        return 0.20
    return 0.50


def _s_tien_ich(v: str, keywords: list[str]) -> float:
    """C5/C6: Đếm số từ khoá có trong chuỗi pipe-separated."""
    if not v:
        return 0.0
    vl = v.lower()
    count = sum(1 for k in keywords if k.lower() in vl)
    return round(min(count / len(keywords), 1.0), 4)


def _s_dien_tich(v) -> float:
    """C7: Diện tích (proxy Ngoại thất)."""
    if not v:
        return 0.5
    x = float(v)
    if x >= 120: return 1.00
    if x >= 90:  return 0.85
    if x >= 70:  return 0.72
    if x >= 55:  return 0.58
    if x >= 40:  return 0.42
    return 0.28


def _s_huong(h1, h2) -> float:
    """C8: Hướng nhà / ban công (phong thuỷ)."""
    MAP = {
        "đông nam": 1.00, "đông bắc": 0.85,
        "nam": 0.80,      "đông": 0.72,
        "bắc": 0.60,      "tây bắc": 0.55,
        "tây": 0.48,      "tây nam": 0.42,
    }
    v = (h1 or h2 or "").lower().strip()
    return MAP.get(v, 0.50)


# ──────────────────────────────────────────────────────────
# B3: Tổng hợp điểm AHP cho 1 căn hộ
# ──────────────────────────────────────────────────────────
HA_TANG_KWS = ["bệnh viện", "trường học", "chợ", "siêu thị", "metro", "bus"]
NOI_KHU_KWS = ["hồ bơi", "gym", "thang máy", "bãi xe", "bảo vệ"]


def score_canho(ch: Any, weights: list[float]) -> dict:
    """
    ch: dict hoặc ORM object có các thuộc tính căn hộ.
    weights: list 8 phần tử từ calc_weights.

    Trả về: {"total": float, "detail": {"C1":float, ..., "C8":float}}
    """
    def g(attr):
        return getattr(ch, attr, None) if not isinstance(ch, dict) else ch.get(attr)

    component_scores = [
        _s_gia(g("gia_ty")),                                     # C1
        _s_noi_that(g("noi_that")),                              # C2
        _s_du_an(g("du_an")),                                    # C3
        _s_phap_ly(g("phap_ly")),                                # C4
        _s_tien_ich(g("tien_ich_ha_tang"), HA_TANG_KWS),        # C5
        _s_tien_ich(g("tien_ich_noi_khu"), NOI_KHU_KWS),        # C6
        _s_dien_tich(g("dien_tich")),                            # C7
        _s_huong(g("huong_nha"), g("huong_ban_cong")),           # C8
    ]

    total = sum(w * s for w, s in zip(weights, component_scores))

    return {
        "total":  round(float(total), 6),
        "detail": {
            f"C{i+1}": round(float(s), 4)
            for i, s in enumerate(component_scores)
        },
    }