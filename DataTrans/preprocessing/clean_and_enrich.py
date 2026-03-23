# src/preprocessing/clean_and_enrich.py
import pathlib

import pandas as pd
import re
import unicodedata
from datetime import datetime
import os
from pathlib import Path

# Đường dẫn
CURRENT_DIR = Path(__file__).resolve().parent
RAW_CSV = CURRENT_DIR.parent / "data-crawling" / "raw" / "raw_data.csv"
CLEANED_DIR = CURRENT_DIR / "processed"
os.makedirs(CLEANED_DIR, exist_ok=True)
CLEANED_CSV = CLEANED_DIR / "cleaned_data.csv"

print(f"Khởi động Pipeline làm sạch dữ liệu...")
print(f"Đang tìm file gốc tại: {RAW_CSV}")

# Các cột giữ lại (chọn lọc)
KEEP_COLUMNS = [
    'ma_tin', 'url', 'title', 'ngay_dang', 'ngay_het_han', 'thumbnail_url', 'thumbnail_path',
    'image_urls', 'image_local_paths', 'gia_ty', 'gia_per_m2_trieu',
    'dien_tich', 'so_phong_ngu', 'so_phong_wc', 'noi_that', 'phap_ly',
    'du_an', 'tien_ich_noi_khu', 'tien_ich_ha_tang', 'huong_nha',
    'huong_ban_cong', 'phuong'
]

TITLE_PREFIXES = [
    'chinh chu gui ban',
    'chinh chu ban',
    'can ban',
    'ban nhanh',
    'gui ban',
    'ban',
]


def normalize_title_prefix(value):
    normalized_value = unicodedata.normalize('NFKD', value)
    return ''.join(char for char in normalized_value if not unicodedata.combining(char)).lower()


def clean_listing_title(title):
    if pd.isna(title):
        return title

    original_title = str(title).strip()
    if not original_title:
        return original_title

    comparable_title = normalize_title_prefix(original_title)
    cleaned_title = original_title

    for prefix in TITLE_PREFIXES:
        if comparable_title.startswith(prefix):
            cleaned_title = original_title[len(prefix):]
            break

    cleaned_title = re.sub(r'^[\s,:\-–—]+', '', cleaned_title).strip()
    return cleaned_title or original_title

# Trọng số AHP (lưu tạm, sau này có thể đưa vào DB riêng)
EXPERT_WEIGHTS = {
    "financial": 0.2295, "design": 0.2295, "developer": 0.1350,
    "legal": 0.0826, "infra": 0.0751, "utilities": 0.0751,
    "landscape": 0.1292, "fengshui": 0.0439
}

# Đọc raw
df = pd.read_csv(RAW_CSV)

for column in KEEP_COLUMNS:
    if column not in df.columns:
        df[column] = None

# 1. Lọc cột
df = df[KEEP_COLUMNS].copy()
df['title'] = df['title'].apply(clean_listing_title)

# 2. Xử lý missing & kiểu dữ liệu
df['gia_ty'] = pd.to_numeric(df['gia_ty'], errors='coerce')
df['dien_tich'] = pd.to_numeric(df['dien_tich'], errors='coerce')
df['so_phong_ngu'] = pd.to_numeric(df['so_phong_ngu'], errors='coerce').fillna(0).astype(int)
df['so_phong_wc'] = pd.to_numeric(df['so_phong_wc'], errors='coerce').fillna(0).astype(int)

# Drop nếu thiếu giá hoặc diện tích
df = df.dropna(subset=['gia_ty', 'dien_tich'])

# Fill missing cho các cột còn lại
df['noi_that'] = df['noi_that'].fillna('Không rõ')
df['phap_ly'] = df['phap_ly'].fillna('Không rõ')
df['du_an'] = df['du_an'].fillna('Không thuộc dự án')
df['thumbnail_url'] = df['thumbnail_url'].fillna('')
df['thumbnail_path'] = df['thumbnail_path'].fillna('')
df['image_urls'] = df['image_urls'].fillna('[]')
df['image_local_paths'] = df['image_local_paths'].fillna('[]')
df['tien_ich_noi_khu'] = df['tien_ich_noi_khu'].fillna('')
df['tien_ich_ha_tang'] = df['tien_ich_ha_tang'].fillna('')
df['huong_nha'] = df['huong_nha'].fillna('Không rõ')
df['huong_ban_cong'] = df['huong_ban_cong'].fillna('Không rõ')
df['phuong'] = df['phuong'].fillna('Không rõ')

# Thêm cột trạng thái & timestamp
df['trang_thai'] = True  # mặc định là True (có thể dùng để đánh dấu tin đã hết hạn sau này)
now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
df['updated_at'] = now_str
df['created_at'] = now_str

# 3. Làm sạch tên dự án (chuẩn hóa)
df['du_an'] = df['du_an'].str.strip().str.title().replace({
    r'\s+': ' ',                        # nhiều khoảng trắng
    'The Origami   Vinhomes Grand Park': 'The Origami - Vinhomes Grand Park',
    # thêm rule khác nếu cần
}, regex=True)

# 4. Loại outlier cơ bản (giá & diện tích)
df = df[(df['gia_ty'].between(1.0, 50.0)) & (df['dien_tich'].between(25, 300))]
df = df[(df['so_phong_ngu'].between(1, 10)) & (df['so_phong_wc'].between(1, 10))]

# 5. Lưu file sạch
df.to_csv(CLEANED_CSV, index=False, encoding='utf-8-sig')
print(f"Đã lưu file sạch: {CLEANED_CSV}")
print(f"Số dòng sau khi xử lý: {len(df)}")
print(df.head())
