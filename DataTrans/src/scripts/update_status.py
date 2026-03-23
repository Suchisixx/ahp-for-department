from database import SessionLocal
from models import CanHo
from datetime import datetime, timedelta
from sqlalchemy import update

def refresh_listings_status():
    db = SessionLocal()
    try:
        # Mốc thời gian 30 ngày trước
        deadline = datetime.now() - timedelta(days=30)
        
        # Lệnh update hàng loạt: trang_thai = False nếu ngay_dang < deadline
        stmt = (
            update(CanHo)
            .where(CanHo.ngay_dang < deadline)
            .where(CanHo.trang_thai == True)
            .values(trang_thai=False)
        )
        
        result = db.execute(stmt)
        db.commit()
        print(f"Đã cập nhật trạng thái False cho {result.rowcount} tin hết hạn.")
    except Exception as e:
        db.rollback()
        print(f"Lỗi khi cập nhật: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    refresh_listings_status()