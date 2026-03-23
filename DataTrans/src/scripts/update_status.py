from datetime import datetime
from pathlib import Path
import sys

from sqlalchemy import update

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal, ensure_canho_schema
from models import CanHo


def refresh_listings_status():
    db = SessionLocal()
    now = datetime.now()

    try:
        ensure_canho_schema()

        expired_stmt = (
            update(CanHo)
            .where(CanHo.ngay_het_han.is_not(None))
            .where(CanHo.ngay_het_han < now)
            .where(CanHo.trang_thai.is_(True))
            .values(trang_thai=False)
        )
        expired_result = db.execute(expired_stmt)

        active_stmt = (
            update(CanHo)
            .where(
                (CanHo.ngay_het_han.is_(None)) |
                (CanHo.ngay_het_han >= now)
            )
            .where(CanHo.trang_thai.is_not(True))
            .values(trang_thai=True)
        )
        active_result = db.execute(active_stmt)

        db.commit()
        print(
            f"Đã tắt {expired_result.rowcount} tin hết hạn và bật lại {active_result.rowcount} tin còn hiệu lực."
        )
    except Exception as e:
        db.rollback()
        print(f"Lỗi khi cập nhật trạng thái: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    refresh_listings_status()
