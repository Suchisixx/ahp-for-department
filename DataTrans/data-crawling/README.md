# 🕷️ Web Crawling Professional Guide
> Hướng dẫn toàn diện thu thập dữ liệu web — Dự án BĐS thuviennhadat.vn (case study)

---

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Trước Khi Crawl: Phân Tích Website](#2-trước-khi-crawl-phân-tích-website)
3. [Quy Trình Crawl Ổn Định](#3-quy-trình-crawl-ổn-định)
4. [Xử Lý Dữ Liệu Sau Crawl](#4-xử-lý-dữ-liệu-sau-crawl)
5. [Kiến Thức Liên Quan](#5-kiến-thức-liên-quan)
6. [Checklist Trước Mỗi Dự Án](#6-checklist-trước-mỗi-dự-án)
7. [Fix Lỗi Thực Tế: thuviennhadat.vn](#7-fix-lỗi-thực-tế-thuviennihadatvn)

---

## 1. Tổng Quan

Web crawling (hay web scraping) là quá trình tự động thu thập dữ liệu từ website.
Đây là kỹ năng cốt lõi trong Data Engineering và Data Science.

### Các khái niệm cơ bản

| Thuật ngữ | Ý nghĩa | Ví dụ |
|-----------|---------|-------|
| Crawler / Spider | Chương trình tự động duyệt web | `crawl_batdongsan.py` |
| HTML Parser | Giải mã HTML để lấy nội dung | BeautifulSoup, lxml |
| HTTP Request | Yêu cầu gửi tới server để lấy trang | `GET /ban-can-ho?page=2` |
| Rate Limiting | Giới hạn số request/giây | `time.sleep(1)` |
| User-Agent | Giả vờ bạn là trình duyệt thực | `Mozilla/5.0...` |
| Pagination | Phân trang của website | `?page=1`, `/trang-2` |
| robots.txt | File quy định được/không được crawl | `/robots.txt` |
| DOM | Cấu trúc cây HTML của trang web | `html > body > div.listing` |

---

## 2. Trước Khi Crawl: Phân Tích Website

> ⏱️ Bước này mất 30–60 phút nhưng tiết kiệm rất nhiều thời gian debugging về sau.

---

### 2.1 Kiểm Tra robots.txt

**Lý do:** File này cho biết trang web có cho phép crawl không, và đường dẫn nào bị cấm.

Truy cập: `https://ten-website.com/robots.txt`

```
# Ví dụ nội dung robots.txt:
User-agent: *
Disallow: /admin/
Disallow: /api/
Allow: /ban-can-ho-chung-cu/
Crawl-delay: 2
```

> ⚠️ **Lưu ý:**
> - Nếu `Disallow: /` → website cấm crawl hoàn toàn, nên tôn trọng
> - `Crawl-delay: 2` → đặt `time.sleep(2)` trong code
> - Vi phạm robots.txt có thể bị block IP hoặc rắc rối pháp lý

---

### 2.2 Xác Định Loại Website

Phân biệt **Static** và **Dynamic** vì cách crawl hoàn toàn khác nhau.

**Cách kiểm tra nhanh:**
Nhấn `Ctrl+U` (View Source):
- Thấy data thực trong HTML → **Static** → dùng `requests + BeautifulSoup` ✅
- Chỉ thấy `<div id="root"></div>` hoặc "Loading..." → **Dynamic** → cần `Selenium` hoặc `Playwright`

| Tiêu chí | Static | Dynamic |
|----------|--------|---------|
| Công nghệ | HTML render từ server | React, Vue, Angular |
| Công cụ | requests + BeautifulSoup | Selenium, Playwright |
| Tốc độ | Nhanh (~0.1–0.5s/trang) | Chậm (~1–3s/trang) |
| Ví dụ | thuviennhadat.vn | batdongsan.com.vn |

---

### 2.3 Xác Định URL Pagination ⚠️ (Bước hay bị bỏ qua nhất)

**Đây chính là lỗi của dự án này** — dùng `?page=N` trong khi site dùng `/trang-N`.

**Cách làm đúng:**
1. Mở trang web trên trình duyệt
2. Bấm sang **trang 2**
3. **Copy URL trên thanh địa chỉ** — đây là URL thật

```
# Các dạng pagination phổ biến:
https://site.com/listing?page=2        # Query param
https://site.com/listing/trang-2       # Path segment ← thuviennhadat.vn dùng cái này
https://site.com/listing/p/2           # Short path
https://site.com/listing/2             # Số thuần
```

**Debug trong code:**
```python
r = requests.get(url)
print(r.url)           # URL sau redirect — nếu luôn là trang 1 thì sai pagination
print(r.status_code)   # Phải là 200
```

---

### 2.4 Phân Tích Cấu Trúc HTML

**Mục tiêu:** Tìm chính xác CSS selector hoặc tag HTML chứa dữ liệu cần lấy.

**Các bước:**
1. Mở **Chrome DevTools**: `F12` hoặc `Ctrl+Shift+I`
2. Click tab **Elements** → dùng công cụ inspect (`Ctrl+Shift+C`) để click vào phần tử
3. Ghi lại: tag HTML, class, id
4. **Kiểm tra tính ổn định**: class/id này có xuất hiện nhất quán trên các trang khác không?
5. Thử selector trong **Console**: `document.querySelectorAll('.your-selector')`

```python
soup = BeautifulSoup(r.text, 'html.parser')

# Tìm tất cả link bài đăng
for a in soup.find_all('a', class_='listing-title'):
    print(a['href'], a.text.strip())

# Hoặc dùng CSS selector
items = soup.select('div.post-item > h3 > a')
```

---

### 2.5 Phân Tích Network Tab (quan trọng với Dynamic site)

1. Mở DevTools → tab **Network** → lọc **XHR/Fetch**
2. **Reload trang**
3. Tìm request trả về JSON

> 💡 **Mẹo:** Nếu thấy request dạng `/api/listings?page=2` → gọi API trực tiếp bằng `requests`, không cần Selenium — nhanh hơn 10 lần.

---

## 3. Quy Trình Crawl Ổn Định

### 3.1 Sơ Đồ Tổng Quát

```
[1. Phân tích] → [2. Prototype] → [3. Crawl đầy đủ] → [4. Validate] → [5. Transform]
   30-60 phút      1-2 trang        toàn bộ data        kiểm tra         làm sạch
```

| Giai đoạn | Nội dung | Output |
|-----------|----------|--------|
| 1. Phân tích | robots.txt, URL, HTML structure, API | Ghi chú selector, pagination pattern |
| 2. Prototype | Test crawl 1-2 trang, verify data | Script test, sample data |
| 3. Crawl đầy đủ | Chạy toàn bộ, xử lý lỗi, checkpoint | `raw_data.csv` |
| 4. Validate | Kiểm tra chất lượng dữ liệu | `quality_report` |
| 5. Transform | Làm sạch, chuẩn hóa, enrich | `clean_data.csv` |

---

### 3.2 Template Code Chuẩn

```python
import requests, csv, time, logging, random
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path

# ── Cấu hình ──────────────────────────────────────────
BASE_URL  = "https://thuviennhadat.vn"
DELAY     = 1.5          # giây giữa các request
MAX_RETRY = 3            # số lần retry khi lỗi
OUTPUT    = "data/raw/raw_data.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}

# ── Logger ────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("crawl.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


# ── Safe Request với retry + exponential backoff ──────
def safe_get(url, retry=MAX_RETRY):
    for i in range(retry):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            return r
        except Exception as e:
            log.warning(f"Retry {i+1}/{retry}: {url} — {e}")
            time.sleep(2 ** i)  # 1s, 2s, 4s
    log.error(f"Bỏ qua URL sau {retry} lần thử: {url}")
    return None


# ── Lấy link từng trang ───────────────────────────────
def get_page_links(page):
    # ✅ Đúng: dùng /trang-N (không phải ?page=N)
    url = f"{BASE_URL}/ban-can-ho-chung-cu-thanh-pho-ho-chi-minh/trang-{page}"
    r = safe_get(url)
    if not r:
        return [], False

    soup = BeautifulSoup(r.text, "html.parser")

    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "pst" in href and href.endswith(".html"):
            if not href.startswith("http"):
                href = BASE_URL + href
            links.append(href)

    # Kiểm tra có trang tiếp theo không
    has_next = bool(soup.find("a", string=lambda t: t and "Tiếp" in t))

    return list(set(links)), has_next


# ── Parse trang chi tiết ──────────────────────────────
def parse_detail(url):
    r = safe_get(url)
    if not r:
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    title    = soup.find("h1")
    price_el = soup.find(class_="price") or soup.find(class_="gia")
    area_el  = soup.find(class_="area")  or soup.find(class_="dien-tich")

    return {
        "url":        url,
        "title":      title.text.strip() if title else None,
        "price":      price_el.text.strip() if price_el else None,
        "area":       area_el.text.strip()  if area_el  else None,
        "location":   "TP.HCM",
        "crawl_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ── Lưu CSV ───────────────────────────────────────────
def save_csv(data, path):
    if not data:
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)


# ── Main crawler với checkpoint ───────────────────────
def crawl(max_pages=50):
    dataset, seen = [], set()

    for page in range(1, max_pages + 1):
        log.info(f"Trang {page}/{max_pages}")
        links, has_next = get_page_links(page)

        if not links:
            log.warning("Không tìm thấy link, dừng crawl")
            break

        for link in links:
            if link in seen:
                continue
            seen.add(link)

            data = parse_detail(link)
            if data:
                dataset.append(data)
                log.info(f"✔ {data['title']}")

            time.sleep(random.uniform(1.0, 2.0))  # random delay

        # Checkpoint: lưu sau mỗi trang (tránh mất data khi crash)
        save_csv(dataset, OUTPUT)
        log.info(f"Checkpoint: đã lưu {len(dataset)} bản ghi")

        if not has_next:
            log.info("Hết trang, kết thúc")
            break

        time.sleep(DELAY)

    return dataset


if __name__ == "__main__":
    data = crawl(max_pages=40)
    log.info(f"Hoàn thành. Tổng: {len(data)} bản ghi")
```

---

### 3.3 Xử Lý Các Trường Hợp Đặc Biệt

| Vấn đề | Triệu chứng | Giải pháp |
|--------|-------------|-----------|
| Bị block IP | Status 403, 429, CAPTCHA | Tăng delay, dùng proxy, rotate User-Agent |
| Trang trả về giống nhau | Total count thấp dù crawl nhiều trang | Kiểm tra URL pagination thực tế |
| Encoding lỗi | Tiếng Việt hiển thị `???` hoặc bị lỗi | `r.encoding = 'utf-8'` |
| Trang không tồn tại | 404, redirect về trang chủ | Kiểm tra `r.status_code` và `r.url` |
| Data null/rỗng | Nhiều trường `None` trong CSV | Kiểm tra lại selector HTML |
| Memory lớn | Script chạy chậm, tốn RAM | Checkpoint: lưu sau mỗi trang |

---

## 4. Xử Lý Dữ Liệu Sau Crawl

### 4.1 Kiểm Tra Chất Lượng

```python
import pandas as pd

df = pd.read_csv("data/raw/raw_data.csv")

print(f"Tổng số bản ghi : {len(df)}")
print(f"Số cột          : {len(df.columns)}")

# Kiểm tra giá trị null
print("\nTỷ lệ null (%):")
print((df.isnull().sum() / len(df) * 100).round(1))

# Kiểm tra duplicate
print(f"\nURL trùng lặp: {df['url'].duplicated().sum()}")

# Xem mẫu
print(df.head(3).to_string())
```

---

### 4.2 Chuẩn Hóa Giá và Diện Tích

```python
import re

def parse_price_to_billion(text):
    """Chuẩn hóa về tỷ đồng"""
    if not text: return None
    text = str(text).lower().replace(",", ".")

    m = re.search(r"([\d.]+)\s*tỷ", text)
    if m: return float(m.group(1))

    m = re.search(r"([\d.]+)\s*triệu", text)
    if m: return float(m.group(1)) / 1000

    return None

def parse_area(text):
    """Chuẩn hóa về m²"""
    if not text: return None
    m = re.search(r"([\d.]+)\s*m[2²]", str(text).lower())
    return float(m.group(1)) if m else None

# Áp dụng
df["price_ty"] = df["price"].apply(parse_price_to_billion)
df["area_m2"]  = df["area"].apply(parse_area)
df["price_m2"] = df["price_ty"] * 1e9 / df["area_m2"]   # giá/m²

print(df[["title", "price_ty", "area_m2", "price_m2"]].describe())
```

---

### 4.3 Cấu Trúc Thư Mục Dự Án Chuẩn

```
project/
├── crawl_batdongsan.py       # Script crawl chính
├── clean_data.py             # Xử lý và chuẩn hóa dữ liệu
├── analyze.py                # Phân tích và visualize
├── requirements.txt          # requests, bs4, pandas...
├── crawl.log                 # Log file tự động tạo
├── .gitignore                # Thêm data/ vào đây
└── data/
    ├── raw/
    │   └── raw_data.csv      # Dữ liệu thô — KHÔNG sửa đổi trực tiếp
    └── clean/
        └── clean_data.csv    # Dữ liệu đã xử lý
```

> 🔒 **Nguyên tắc vàng:**
> - **KHÔNG** bao giờ sửa thẳng vào `raw_data.csv` — luôn copy sang `clean/`
> - Giữ toàn bộ dữ liệu gốc để có thể re-process bất kỳ lúc nào
> - Thêm `data/` vào `.gitignore`

---

## 5. Kiến Thức Liên Quan

### 5.1 HTTP Status Codes

| Code | Ý nghĩa | Xử lý |
|------|---------|-------|
| `200` | OK — thành công | Bình thường |
| `301/302` | Redirect | requests tự follow, kiểm tra `r.url` |
| `403` | Forbidden — bị chặn | Đổi User-Agent, thêm headers |
| `404` | Not Found | Bỏ qua URL này |
| `429` | Too Many Requests | Tăng `time.sleep`, dùng proxy |
| `500` | Server Error | Retry sau |

---

### 5.2 CSS Selectors trong BeautifulSoup

| Selector | BeautifulSoup | CSS (`soup.select`) |
|----------|---------------|---------------------|
| Tag | `soup.find('h1')` | `soup.select('h1')` |
| Class | `soup.find(class_='price')` | `soup.select('.price')` |
| ID | `soup.find(id='main')` | `soup.select('#main')` |
| Lồng nhau | `soup.find('div').find('a')` | `soup.select('div > a')` |
| Attribute | `soup.find('a', href=True)` | `soup.select('a[href]')` |
| Nhiều kết quả | `soup.find_all('a')` | `soup.select('a')` |

---

### 5.3 Chống Bị Block

```python
import random

# 1. Rotate User-Agent
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
]

# 2. Random delay (tránh pattern đều đặn dễ bị phát hiện)
time.sleep(random.uniform(1.0, 2.5))

# 3. Dùng Session để giữ cookie
session = requests.Session()
session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

# 4. Thêm Referer
HEADERS["Referer"] = BASE_URL
```

---

### 5.4 Khi Nào Dùng Công Cụ Khác

| Tình huống | Công cụ | Ghi chú |
|------------|---------|---------|
| Website dùng JavaScript (React, Vue) | Playwright hoặc Selenium | Chậm hơn nhưng crawl được JS |
| Có API JSON rõ ràng | `requests + .json()` | **Nhanh nhất, ổn định nhất** |
| Crawl quy mô lớn (>10k) | Scrapy framework | Hỗ trợ async, pipeline có sẵn |
| Website tương tác phức tạp | Playwright (Python) | Click, scroll, form submit |
| Cần lưu vào database | Scrapy + SQLAlchemy | Pipeline tự động lưu DB |

---

## 6. Checklist Trước Mỗi Dự Án

### Giai đoạn 1 — Phân tích (trước khi viết code)
- [ ] Kiểm tra `robots.txt` và Terms of Service
- [ ] Xác định website Static hay Dynamic (`Ctrl+U` View Source)
- [ ] Tìm URL pagination chính xác (click sang trang 2 và xem URL)
- [ ] Inspect HTML tìm selector của: tiêu đề, giá, diện tích, địa chỉ, link
- [ ] Kiểm tra có API JSON không (Network tab)
- [ ] Verify selector ổn định trên nhiều trang khác nhau

### Giai đoạn 2 — Prototype (1–2 trang đầu)
- [ ] Crawl thử 1 trang, in kết quả ra terminal
- [ ] Xác nhận URL sau redirect đúng (`print(r.url)`)
- [ ] Kiểm tra encoding Tiếng Việt đúng
- [ ] Xác nhận pagination hoạt động (trang 2 khác trang 1)
- [ ] Kiểm tra data không bị null

### Giai đoạn 3 — Crawl đầy đủ
- [ ] Bật logging ra file (`crawl.log`)
- [ ] Thêm checkpoint: lưu CSV sau mỗi trang
- [ ] Thêm xử lý lỗi (`try/except` + retry)
- [ ] Thêm kiểm tra trang cuối (dừng khi không có next page)
- [ ] Chạy 5–10 trang đầu để ước tính tốc độ và thời gian
- [ ] Monitor log trong quá trình chạy

### Giai đoạn 4 — Validate dữ liệu
- [ ] Tổng số bản ghi thực tế vs kỳ vọng
- [ ] Tỷ lệ null < 10% cho các trường quan trọng
- [ ] Không có URL trùng lặp
- [ ] Tiếng Việt hiển thị đúng
- [ ] Giá và diện tích nằm trong range hợp lý

---

## 7. Fix Lỗi Thực Tế: thuviennhadat.vn

### Triệu chứng
```
Scraping page 1  → Found 15 links
Scraping page 2  → Found 15 links
...
Scraping page 40 → Found 15 links
Total: 15  ← chỉ 15 dù crawl 40 trang!
```

### Nguyên nhân
Server **ignore** param `?page=N` và luôn trả về trang 1.
Tất cả 15 link ở mọi trang đều là cùng 15 link của trang 1.

### Giải pháp

```python
# ❌ SAI — server ignore ?page=N
url = f"{BASE_URL}/ban-can-ho-chung-cu-thanh-pho-ho-chi-minh?page={page}"

# ✅ ĐÚNG — pagination thật dùng path segment
url = f"{BASE_URL}/ban-can-ho-chung-cu-thanh-pho-ho-chi-minh/trang-{page}"
```

### Quy tắc rút ra

> **Luôn mở trình duyệt, click sang trang 2 và copy EXACT URL trước khi viết code pagination.**
> Đừng đoán — xem thực tế.

---

## 📦 Requirements

```
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
pandas>=2.0.0
```

Cài đặt:
```bash
pip install -r requirements.txt
```

---

*Cập nhật lần cuối: 2026-03-12 — Dự án crawl BĐS thuviennhadat.vn*
