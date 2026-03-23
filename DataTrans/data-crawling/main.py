"""
main.py
══════════════════════════════════════════════════════════════════
Entry point crawler thuviennhadat.vn

Chạy:
    python main.py                   # mặc định 40 trang
    python main.py --pages 10        # giới hạn 10 trang
    python main.py --pages 5 --fresh # bỏ qua data cũ, crawl lại từ đầu

Pipeline tổng:
    main.py (crawl) → raw_data.csv
    → clean_data.py → clean_data.csv
    → ahp_transform.py → ahp_scored_data.csv
    → db_load.py → SQL Server (CanHo + ChiTietCH)
══════════════════════════════════════════════════════════════════
"""

import argparse
import random
import time

from config import OUTPUT, DELAY_MIN, DELAY_MAX, log
from utils import download_listing_images, save_csv, load_existing
from parsers import get_listing_links, parse_detail


# ══════════════════════════════════════════════════════════════════════════════
# CRAWLER CHÍNH
# ══════════════════════════════════════════════════════════════════════════════

def crawl(max_pages: int = 5, fresh: bool = False) -> list[dict]:
    """
    Crawl nhiều trang, tích lũy data, checkpoint sau mỗi trang.

    Args:
        max_pages : Số trang tối đa cần crawl.
        fresh     : True → bỏ qua data cũ, crawl lại từ đầu.

    Returns:
        dataset: list[dict] toàn bộ records đã crawl.
    """
    if fresh:
        log.info("  [--fresh] Bỏ qua data cũ — bắt đầu lại từ trang 1.")
        dataset, seen_urls = [], set()
    else:
        dataset, seen_urls = load_existing(OUTPUT)

    start_n = len(dataset)

    for page in range(1, max_pages + 1):
        log.info(f"═══ Trang {page}/{max_pages} ═══")

        links, has_next = get_listing_links(page)
        if not links:
            log.warning("Không có link — dừng.")
            break

        new_links = [lnk for lnk in links if lnk not in seen_urls]
        log.info(f"  Mới: {len(new_links)} | Bỏ qua (đã có): {len(links) - len(new_links)}")

        for link in new_links:
            seen_urls.add(link)
            data = parse_detail(link)
            if data:
                saved_images = download_listing_images(
                    data.get("ma_tin"),
                    data.get("image_urls"),
                )
                if saved_images:
                    data["image_local_paths"] = list(saved_images.values())
                    data["thumbnail_path"] = (
                        saved_images.get(data.get("thumbnail_url"))
                        or data["image_local_paths"][0]
                    )

                dataset.append(data)
                log.info(
                    f"  ✔ [{data.get('ma_tin', '?')}] "
                    f"{data.get('gia_ty')}tỷ | "
                    f"{data.get('dien_tich')}m² | "
                    f"{data.get('so_phong_ngu')}PN/{data.get('so_phong_wc')}WC | "
                    f"NT={data.get('noi_that')} | "
                    f"PL={data.get('phap_ly')} | "
                    f"T={data.get('tang')}"
                )
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

        # Checkpoint — ghi sau mỗi trang để không mất data
        save_csv(dataset)
        log.info(f"  Tổng tích lũy: {len(dataset)} (+{len(dataset) - start_n} mới)")

        if not has_next:
            log.info("Hết trang — kết thúc.")
            break

        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    added = len(dataset) - start_n
    log.info(f"Hoàn thành. +{added} mới | Tổng: {len(dataset)} | Output: {OUTPUT}")
    return dataset


# ══════════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════════

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crawler căn hộ TP.HCM — thuviennhadat.vn"
    )
    parser.add_argument(
        "--pages", type=int, default=5,
        help="Số trang tối đa (mặc định: 5)",
    )
    parser.add_argument(
        "--fresh", action="store_true",
        help="Bỏ qua data cũ, crawl lại từ đầu",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    data = crawl(max_pages=args.pages, fresh=args.fresh)
    print(f"\nTotal: {len(data)} records → {OUTPUT}")
