"""
utils.py
══════════════════════════════════════════════════════════════════
Các hàm tiện ích chung:
  - safe_get      : HTTP GET với retry + exponential backoff
  - clean         : Xóa whitespace thừa
  - first_match   : Regex helper trả về group(1)
  - save_csv      : Ghi dataset → CSV (luôn ghi lại từ đầu)
  - load_existing : Load CSV cũ để crawl tiếp không mất data
══════════════════════════════════════════════════════════════════
"""

import csv
import json
import re
import time
from mimetypes import guess_extension
from pathlib import Path
from urllib.parse import urlparse

import requests

from config import HEADERS, IMAGE_DIR, MAX_RETRY, OUTPUT, FIELDNAMES, log


# ── HTTP ──────────────────────────────────────────────────────────────────────

def safe_get(url: str) -> requests.Response | None:
    """GET với retry + exponential backoff. Trả về None nếu hết retry."""
    for i in range(MAX_RETRY):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            return r
        except Exception as e:
            wait = 2 ** i
            log.warning(f"Retry {i+1}/{MAX_RETRY} sau {wait}s — {url} — {e}")
            time.sleep(wait)
    log.error(f"Bỏ qua (hết retry): {url}")
    return None


# ── Text helpers ──────────────────────────────────────────────────────────────

def clean(text: str | None) -> str | None:
    """Xóa whitespace thừa, trả về None nếu rỗng."""
    if text is None:
        return None
    return " ".join(str(text).split()).strip() or None


def first_match(pattern: str, text: str, flags=re.IGNORECASE) -> str | None:
    """Tìm regex, trả về group(1) nếu khớp, None nếu không."""
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else None


def _serialize_cell(value):
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value


def _guess_image_extension(image_url: str, content_type: str | None = None) -> str:
    suffix = Path(urlparse(image_url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}:
        return suffix

    if content_type:
        guessed = guess_extension(content_type.split(";")[0].strip())
        if guessed:
            return ".jpg" if guessed == ".jpe" else guessed

    return ".jpg"


def download_listing_images(ma_tin: str | None, image_urls: list[str] | None) -> dict[str, str]:
    if not ma_tin or not image_urls:
        return {}

    listing_dir = Path(IMAGE_DIR) / str(ma_tin)
    listing_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: dict[str, str] = {}

    for index, image_url in enumerate(image_urls, start=1):
        if not image_url:
            continue

        try:
            response = requests.get(image_url, headers=HEADERS, timeout=20)
            response.raise_for_status()
        except Exception as exc:
            log.warning(f"Không tải được ảnh {image_url}: {exc}")
            continue

        extension = _guess_image_extension(
            image_url,
            response.headers.get("Content-Type"),
        )
        file_path = listing_dir / f"{index:02d}{extension}"
        file_path.write_bytes(response.content)
        saved_paths[image_url] = file_path.as_posix()

    return saved_paths


# ── CSV I/O ───────────────────────────────────────────────────────────────────

def save_csv(dataset: list[dict], path: str = OUTPUT):
    """Ghi toàn bộ dataset vào CSV (mode 'w' — tránh trùng header)."""
    if not dataset:
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(
            {
                key: _serialize_cell(value)
                for key, value in row.items()
            }
            for row in dataset
        )
    log.info(f"  💾 {len(dataset)} rows → {path}")


def load_existing(path: str = OUTPUT) -> tuple[list[dict], set[str]]:
    """Load CSV cũ để crawl tiếp, không mất data đã có.

    Returns:
        dataset  : list[dict] — các row đã crawl
        seen_urls: set[str]   — tập URL đã crawl (dùng để skip)
    """
    if not Path(path).exists():
        log.info("  Chưa có file cũ — bắt đầu mới.")
        return [], set()
    dataset, seen = [], set()
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            dataset.append(dict(row))
            if row.get("url"):
                seen.add(row["url"])
    log.info(f"  Load file cũ: {len(dataset)} dòng → crawl tiếp phần mới.")
    return dataset, seen
