"""
config.py
══════════════════════════════════════════════════════════════════
Toàn bộ hằng số cấu hình cho crawler thuviennhadat.vn:
  - URL, output path, delay, retry
  - HTTP headers
  - Regex patterns dùng chung (HUONG_RE, DU_AN_*)
  - FIELDNAMES — thứ tự cột CSV output
══════════════════════════════════════════════════════════════════
"""

import re
import logging
from pathlib import Path

# ── URL & paths ───────────────────────────────────────────────────────────────
CURRENT_DIR = Path(__file__).resolve().parent
RAW_DIR   = CURRENT_DIR / "raw"
BASE_URL  = "https://thuviennhadat.vn"
LIST_URL  = BASE_URL + "/ban-can-ho-chung-cu-thanh-pho-ho-chi-minh?trang={page}"
OUTPUT    = str(RAW_DIR / "raw_data.csv")
IMAGE_DIR = str(RAW_DIR / "images")

# ── Crawl settings ────────────────────────────────────────────────────────────
DELAY_MIN = 2.5   # giây, giữa mỗi request
DELAY_MAX = 4.5
MAX_RETRY = 3

# ── HTTP headers ──────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": BASE_URL,
}

# ── Regex patterns dùng chung ─────────────────────────────────────────────────

# Hướng nhà / ban công
HUONG_RE = r"(Đông Nam|Đông Bắc|Tây Nam|Tây Bắc|Đông|Tây|Nam|Bắc)"

# Dự án lớn → tự điền tiện ích nội khu (Hồ bơi | Gym | Bãi xe)
DU_AN_TICH_RE = re.compile(
    r"sky garden|phú mỹ hưng|vinhomes|masterise|scenic valley|"
    r"urban hill|origami|ascentia|the era|seasons|lavida|gamuda|novaland",
    re.IGNORECASE,
)

# Tên dự án để ghi vào du_an_hint
DU_AN_NAME_RE = re.compile(
    r"(vinhomes|novaland|masterise|capitaland|gamuda|hưng thịnh|nam long|"
    r"đất xanh|phú mỹ hưng|sun group|an gia|khang điền|sky garden|"
    r"scenic valley|urban hill|the origami|the ascentia|the era|seasons avenue|"
    r"lavida|river panorama|midtown|eco green|an bình)",
    re.IGNORECASE,
)

# ── Thứ tự cột CSV output ─────────────────────────────────────────────────────
FIELDNAMES = [
    # Meta
    "url", "ma_tin", "title", "crawl_time",
    "ngay_dang", "ngay_het_han", "sdt", "dia_chi", "phuong", "location",
    "thumbnail_url", "thumbnail_path", "image_urls", "image_local_paths",
    # C1 — Tài chính
    "gia_ty", "gia_per_m2_trieu", "dien_tich",
    # C2 — Nội thất / Không gian
    "so_phong_ngu", "so_phong_wc", "wc_inferred", "noi_that", "tang",
    # C3 — Chủ đầu tư
    "du_an", "du_an_hint",
    # C4 — Pháp lý
    "phap_ly",
    # C5 — Hạ tầng xã hội
    "tien_ich_ha_tang",
    # C6 — Tiện ích nội khu
    "tien_ich_noi_khu",
    # C7 — Ngoại thất / View
    "huong_view",
    # C8 — Phong thủy
    "huong_nha", "huong_ban_cong",
]

# ── Logger (dùng chung toàn project) ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(CURRENT_DIR / "crawl.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("crawler")
