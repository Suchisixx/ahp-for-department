"""
scripts/import_csv.py
════════════════════════════════════════════════════
Import cleaned_data.csv vào bảng can_ho (PostgreSQL).
Dùng UPSERT: nếu ma_tin đã tồn tại → cập nhật, không tạo trùng.

Chạy:
    cd backend
    python scripts/import_csv.py --csv ../cleaned_data.csv
════════════════════════════════════════════════════
"""
import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

# Thêm thư mục cha vào sys.path để import database/models
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal, engine, Base
from models import CanHo


def parse_date(s: str):
    if not s:
        return None
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


def to_float(s):
    try:
        return float(s) if s and s.strip() else None
    except ValueError:
        return None


def to_int(s):
    try:
        return int(float(s)) if s and s.strip() else None
    except ValueError:
        return None


def clean_str(s: str, unknown=("Không rõ", "không rõ", "")):
    s = (s or "").strip()
    return None if s in unknown else s


def import_csv(csv_path: str):
    # Tạo bảng nếu chưa có
    Base.metadata.create_all(bind=engine)

    path = Path(csv_path)
    if not path.exists():
        print(f"[ERROR] Không tìm thấy file: {csv_path}")
        sys.exit(1)

    db = SessionLocal()
    inserted = updated = skipped = 0

    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Đọc {len(rows)} dòng từ {path.name} ...")

    for row in rows:
        ma_tin = (row.get("ma_tin") or "").strip()
        if not ma_tin:
            skipped += 1
            continue

        existing = db.query(CanHo).filter(CanHo.ma_tin == ma_tin).first()

        data = {
            "ma_tin":           ma_tin,
            "url":              clean_str(row.get("url")),
            "title":            clean_str(row.get("title")),
            "ngay_dang":        parse_date(row.get("ngay_dang")),
            "gia_ty":           to_float(row.get("gia_ty")),
            "gia_per_m2":       to_float(row.get("gia_per_m2_trieu")),
            "dien_tich":        to_float(row.get("dien_tich")),
            "so_phong_ngu":     to_int(row.get("so_phong_ngu")),
            "so_phong_wc":      to_int(row.get("so_phong_wc")),
            "noi_that":         clean_str(row.get("noi_that")),
            "du_an":            clean_str(row.get("du_an")),
            "phap_ly":          clean_str(row.get("phap_ly")),
            "tien_ich_ha_tang": clean_str(row.get("tien_ich_ha_tang")),
            "tien_ich_noi_khu": clean_str(row.get("tien_ich_noi_khu")),
            "huong_nha":        clean_str(row.get("huong_nha")),
            "huong_ban_cong":   clean_str(row.get("huong_ban_cong")),
            "phuong":           clean_str(row.get("phuong")),
            "trang_thai":      clean_str(row.get("trang_thai")),
        }

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.updated_at = datetime.now()
            updated += 1
        else:
            db.add(CanHo(**data))
            inserted += 1

        # Commit mỗi 50 dòng để tránh lock lâu
        if (inserted + updated) % 50 == 0:
            db.commit()

    db.commit()
    db.close()

    print(f"\n Hoàn thành:")
    print(f"   Mới thêm  : {inserted}")
    print(f"   Cập nhật  : {updated}")
    print(f"   Bỏ qua    : {skipped}")
    print(f"   Tổng cộng : {inserted + updated + skipped}")


def import_cleaned_data():
    """
    Import dữ liệu từ file cleaned_data.csv mặc định vào database.
    Đường dẫn mặc định: D:\HHTRQD\DataTrans\preprocessing\processed\cleaned_data.csv
    """
    default_csv_path = r"D:\HHTRQD\DataTrans\preprocessing\processed\cleaned_data.csv"
    import_csv(default_csv_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import cleaned_data.csv → PostgreSQL")
    parser.add_argument("--csv", help="Đường dẫn tới file CSV")
    parser.add_argument("--default", action="store_true", help="Sử dụng đường dẫn CSV mặc định")
    args = parser.parse_args()
    
    if args.default:
        import_cleaned_data()
    else:
        csv_path = args.csv or r"D:\HHTRQD\DataTrans\preprocessing\processed\cleaned_data.csv"
        import_csv(csv_path)