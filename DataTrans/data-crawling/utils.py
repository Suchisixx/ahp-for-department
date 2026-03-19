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
import re
import time
from pathlib import Path

import requests

from config import HEADERS, MAX_RETRY, OUTPUT, FIELDNAMES, log


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


# ── CSV I/O ───────────────────────────────────────────────────────────────────

def save_csv(dataset: list[dict], path: str = OUTPUT):
    """Ghi toàn bộ dataset vào CSV (mode 'w' — tránh trùng header)."""
    if not dataset:
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(dataset)
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