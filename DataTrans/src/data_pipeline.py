# src/data_pipeline.py
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
from models import CanHo

# Đường dẫn tới các script
CRAWL_SCRIPT = Path(__file__).parent.parent / "data-crawling" / "main.py"
CLEAN_SCRIPT = Path(__file__).parent.parent / "preprocessing" / "clean_and_enrich.py"
IMPORT_SCRIPT = Path(__file__).parent / "scripts" / "import_csv.py"

def is_data_fresh() -> bool:
    """
    Kiểm tra data có mới không (dựa trên updated_at của bản ghi mới nhất).
    Nếu data cũ hơn 1 giờ, cần crawl lại.
    """
    db: Session = SessionLocal()
    try:
        latest = db.query(CanHo.updated_at).order_by(CanHo.updated_at.desc()).first()
        if not latest:
            return False  # Chưa có data
        return (datetime.now() - latest[0]) < timedelta(hours=1)
    finally:
        db.close()

def run_crawl():
    """Chạy script crawl data."""
    try:
        result = subprocess.run([sys.executable, str(CRAWL_SCRIPT)], capture_output=True, text=True, cwd=CRAWL_SCRIPT.parent)
        if result.returncode != 0:
            raise Exception(f"Crawl failed: {result.stderr}")
        print("Crawl completed successfully.")
    except Exception as e:
        print(f"Error in crawl: {e}")
        raise

def run_clean():
    """Chạy script clean data."""
    try:
        result = subprocess.run([sys.executable, str(CLEAN_SCRIPT)], capture_output=True, text=True, cwd=CLEAN_SCRIPT.parent)
        if result.returncode != 0:
            raise Exception(f"Clean failed: {result.stderr}")
        print("Clean completed successfully.")
    except Exception as e:
        print(f"Error in clean: {e}")
        raise

def run_import():
    """Chạy script import data vào DB."""
    try:
        result = subprocess.run([sys.executable, str(IMPORT_SCRIPT), "--default"], capture_output=True, text=True, cwd=IMPORT_SCRIPT.parent)
        if result.returncode != 0:
            raise Exception(f"Import failed: {result.stderr}")
        print("Import completed successfully.")
    except Exception as e:
        print(f"Error in import: {e}")
        raise

def run_data_pipeline():
    """
    Chạy toàn bộ pipeline: crawl → clean → import.
    Chỉ chạy nếu data không fresh.
    """
    if is_data_fresh():
        print("Data is fresh, skipping pipeline.")
        return
    
    print("Starting data pipeline...")
    run_crawl()
    run_clean()
    run_import()
    print("Data pipeline completed.")