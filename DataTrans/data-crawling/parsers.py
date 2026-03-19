"""
parsers.py
══════════════════════════════════════════════════════════════════
Toàn bộ logic parse HTML cho thuviennhadat.vn:

  Trang danh sách:
    get_listing_links()      — lấy link + has_next_page

  Trang chi tiết — 4 nguồn có cấu trúc (theo thứ tự ưu tiên):
    _parse_feature_block()   — block "Đặc điểm bất động sản"
    _parse_schema_json()     — <script type="application/ld+json">
    _parse_current_data_js() — var currentData = {...}
    _parse_meta_dates()      — block ngày đăng / hết hạn / mã tin

  Helpers:
    _parse_price()           — chuỗi giá → float tỷ
    _parse_sdt()             — lấy SĐT đầy đủ (ưu tiên broker section)
    parse_url_slug()         — slug URL → phuong, du_an, ma_tin
    extract_from_title()     — fallback khi trang bị block

  Hàm tổng hợp:
    parse_detail()           — gọi tất cả nguồn, merge kết quả → dict
══════════════════════════════════════════════════════════════════
"""

import json
import re
from datetime import datetime

from bs4 import BeautifulSoup

from config import (
    BASE_URL, LIST_URL, HUONG_RE,
    DU_AN_TICH_RE, DU_AN_NAME_RE, log,
)
from utils import safe_get, clean


# ══════════════════════════════════════════════════════════════════════════════
# TRANG DANH SÁCH
# ══════════════════════════════════════════════════════════════════════════════

def get_listing_links(page: int) -> tuple[list[str], bool]:
    """
    Trả về (links, has_next_page).
    URL pagination: ?trang={page}
    Link bài đăng nhận ra qua pattern: /...-pstXXXXX.html
    """
    url = LIST_URL.format(page=page)
    r = safe_get(url)
    if not r:
        return [], False

    soup = BeautifulSoup(r.text, "html.parser")
    links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r"pst\d+\.html$", href):
            if not href.startswith("http"):
                href = BASE_URL + href
            links.add(href)

    has_next = bool(
        soup.find("a", string=re.compile(r"(Tiếp|Next|›|»)", re.I))
        or soup.find("a", href=re.compile(rf"trang={page+1}"))
    )

    log.info(f"  Trang {page}: {len(links)} links, has_next={has_next}")
    return list(links), has_next


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS GIÁ & URL
# ══════════════════════════════════════════════════════════════════════════════

def _parse_price(text: str) -> float | None:
    """
    Chuẩn hoá chuỗi giá → float (đơn vị tỷ VND).
    VD: '3,20 tỷ' → 3.2 | '6 tỷ 600 triệu' → 6.6 | '699 triệu' → 0.699
    """
    if not text:
        return None
    t = str(text).lower().replace(",", ".")
    m = re.search(r"([\d.]+)\s*tỷ\s*([\d.]+)\s*triệu", t)
    if m:
        return round(float(m.group(1)) + float(m.group(2)) / 1000, 3)
    m = re.search(r"([\d.]+)\s*tỷ", t)
    if m:
        return float(m.group(1))
    m = re.search(r"([\d.]+)\s*triệu", t)
    if m:
        return round(float(m.group(1)) / 1000, 3)
    return None


def parse_url_slug(url: str) -> dict:
    """
    Phân tích slug URL → {'phuong', 'du_an', 'ma_tin'}.
    VD: /ban-can-ho-phuong-5-quan-5-pj-an-binh-pst144882.html
    """
    result = {"phuong": None, "du_an": None, "ma_tin": None}
    try:
        slug = url.replace(BASE_URL, "").lstrip("/").split("/")[0]
    except Exception:
        return result

    m = re.search(r"pj-(.+)$", slug)
    if m:
        result["du_an"] = m.group(1).replace("-", " ").title()

    m = re.search(r"phuong-(.+?)(?:-pj|$)", slug)
    if m:
        raw = m.group(1).replace("-", " ").strip()
        result["phuong"] = f"Phường {raw}" if re.match(r"^\d+$", raw) else raw.title()

    m = re.search(r"pst(\d+)\.html", url)
    if m:
        result["ma_tin"] = m.group(1)

    return result


# ══════════════════════════════════════════════════════════════════════════════
# FALLBACK: EXTRACT TỪ TITLE (khi trang chi tiết bị block)
# ══════════════════════════════════════════════════════════════════════════════

def extract_from_title(title: str, pn_hint=None) -> dict:
    """
    Khi trang bị block (trả về "Tài khoản: 0" hoặc quá ngắn),
    cố gắng trích xuất thông tin từ chuỗi title bài đăng.
    """
    t  = str(title)
    tl = t.lower()
    out = {k: None for k in [
        "gia_ty", "dien_tich", "so_phong_ngu", "so_phong_wc", "wc_inferred",
        "noi_that", "tang", "phap_ly", "huong_nha", "huong_ban_cong",
        "huong_view", "tien_ich_noi_khu", "tien_ich_ha_tang", "du_an_hint",
    ]}
    out["wc_inferred"] = False

    # Giá
    out["gia_ty"] = _parse_price(t)

    # Diện tích
    m = re.search(r"(\d{2,4}(?:[,.]\\d+)?)\s*m[²2²]", tl)
    if m:
        try:
            out["dien_tich"] = float(m.group(1).replace(",", "."))
        except Exception:
            pass

    # Phòng ngủ
    m = re.search(r"(\d+)\s*(?:pn\b|phòng\s*ngủ)", tl)
    pn = int(m.group(1)) if m else (int(float(pn_hint)) if pn_hint else None)
    out["so_phong_ngu"] = pn

    # Phòng WC
    m = re.search(r"(\d+)\s*(?:phòng\s*)?(?:wc|tắm|vệ\s*sinh)\b", tl)
    if not m:
        m = re.search(r"\d+\s*pn\s*[-–]\s*(\d+)\s*wc", tl)
    if m:
        out["so_phong_wc"] = int(m.group(1))
    elif pn:
        out["so_phong_wc"] = max(1, pn - 1)
        out["wc_inferred"] = True

    # Nội thất — ưu tiên pattern rõ nhất trước
    m = re.search(r"nội thất\s*(cơ bản|đầy đủ|cao cấp|không có|full)", tl)
    if m:
        v = m.group(1)
        out["noi_that"] = "Đầy đủ" if v == "full" else v.title()
    elif re.search(r"đầy đủ\s*nội thất|full\s*nội thất|nội thất\s*(đẹp|mới|xịn|cao)", tl):
        out["noi_that"] = "Đầy đủ"
    elif re.search(r"bàn giao\s*(hoàn thiện|đầy đủ|full)|hoàn thiện\s*nội thất", tl):
        out["noi_that"] = "Đầy đủ"
    elif re.search(r"bàn giao\s*(thô|cơ bản)|nhà\s*(thô|trống)", tl):
        out["noi_that"] = "Không có"
    elif re.search(r"nhà\s*(mới|đẹp|xịn)\s*(đẹp|100%)?", tl):
        out["noi_that"] = "Đầy đủ"

    # Tầng
    m = re.search(r"(?:tầng|lầu)\s*(\d+)", tl)
    if m:
        out["tang"] = int(m.group(1))

    # Pháp lý — từ rộng nhất đến hẹp nhất
    if re.search(r"sổ\s*(?:đỏ|hồng)|shr\b|sổ\s*riêng|sổ\s*cầm\s*tay", tl):
        out["phap_ly"] = "Sổ đỏ/Sổ hồng"
    elif re.search(r"giấy tờ hợp lệ|hợp đồng mua bán|pháp lý\s*(rõ|đầy đủ|ok)", tl):
        out["phap_ly"] = "Giấy tờ hợp lệ"
    elif re.search(r"chưa có sổ|đang\s*(?:chờ|làm)\s*sổ", tl):
        out["phap_ly"] = "Chưa có sổ"

    # View
    if   re.search(r"view sông|nhìn sông|hướng sông", tl):       out["huong_view"] = "View sông"
    elif re.search(r"view công viên", tl):                         out["huong_view"] = "View công viên"
    elif re.search(r"view thành phố|city view|toàn cảnh", tl):    out["huong_view"] = "View thành phố"
    elif re.search(r"căn góc|\d+\s*view|lô góc", tl):             out["huong_view"] = "Căn góc 2 view"

    # Hướng nhà / ban công
    m = re.search(rf"hướng\s+{HUONG_RE}", t, re.I)
    if m: out["huong_nha"] = m.group(1)
    m = re.search(rf"ban\s*công\s*hướng\s*{HUONG_RE}", t, re.I)
    if m: out["huong_ban_cong"] = m.group(1)

    # Tiện ích nội khu
    tich = []
    if re.search(r"hồ bơi|bể bơi", tl):       tich.append("Hồ bơi")
    if re.search(r"\bgym\b|phòng gym", tl):    tich.append("Gym")
    if re.search(r"thang máy", tl):            tich.append("Thang máy")
    if re.search(r"bãi xe|hầm xe|parking", tl): tich.append("Bãi xe")
    if DU_AN_TICH_RE.search(tl):
        for x in ("Hồ bơi", "Gym", "Bãi xe"):
            if x not in tich: tich.append(x)
    out["tien_ich_noi_khu"] = " | ".join(tich) or None

    # Hạ tầng xã hội
    ht = []
    if re.search(r"bệnh viện|\bbv\b", tl):                         ht.append("Bệnh viện")
    if re.search(r"trường học|các cấp|trường tiểu|trường thpt", tl): ht.append("Trường học")
    if re.search(r"chợ|siêu thị|vinmart|aeon|coopmart", tl):        ht.append("Chợ/Siêu thị")
    if re.search(r"metro|ga tàu|xe buýt", tl):                       ht.append("Metro/Bus")
    out["tien_ich_ha_tang"] = " | ".join(ht) or None

    # Tên dự án
    m = DU_AN_NAME_RE.search(tl)
    if m: out["du_an_hint"] = m.group(1).title()

    return out


# ══════════════════════════════════════════════════════════════════════════════
# 4 NGUỒN CÓ CẤU TRÚC — TRANG CHI TIẾT
# ══════════════════════════════════════════════════════════════════════════════

def _parse_feature_block(soup) -> dict:
    """
    Parse block id='grid-realestate-feature'.
    Mỗi row: label (unit-name-style) + value (floated end).
    Trả về: gia_ty, dien_tich, so_phong_ngu, so_phong_wc,
            phap_ly, noi_that, huong_nha, huong_ban_cong
    """
    result = {}
    block = soup.find("div", id="grid-realestate-feature")
    if not block:
        return result

    for row in block.find_all("div", class_=lambda c: c and "ui" in c and "grid" in c):
        cols = row.find_all("div", recursive=False)
        if len(cols) < 2:
            continue
        label = cols[0].get_text(" ", strip=True).lower()
        value = cols[1].get_text(" ", strip=True)
        vl    = value.lower()

        if "mức giá" in label:
            result["gia_ty"] = _parse_price(value)

        elif "diện tích" in label:
            m = re.search(r"([\d,\.]+)", value)
            if m:
                try: result["dien_tich"] = float(m.group(1).replace(",", "."))
                except Exception: pass

        elif "phòng ngủ" in label:
            m = re.search(r"(\d+)", value)
            if m: result["so_phong_ngu"] = int(m.group(1))

        elif "phòng wc" in label or "nhà vệ sinh" in label or "phòng tắm" in label:
            m = re.search(r"(\d+)", value)
            if m: result["so_phong_wc"] = int(m.group(1))

        elif "pháp lý" in label:
            if re.search(r"sổ đỏ|sổ hồng", vl):   result["phap_ly"] = "Sổ đỏ/Sổ hồng"
            elif "giấy tờ hợp lệ" in vl:            result["phap_ly"] = "Giấy tờ hợp lệ"
            elif "chưa có sổ" in vl:                 result["phap_ly"] = "Chưa có sổ"
            else:                                    result["phap_ly"] = value.strip()

        elif "nội thất" in label:
            if re.search(r"đầy đủ|full", vl):       result["noi_that"] = "Đầy đủ"
            elif "cơ bản" in vl:                     result["noi_that"] = "Cơ bản"
            elif "cao cấp" in vl:                    result["noi_that"] = "Cao cấp"
            elif re.search(r"không có|không nội thất", vl): result["noi_that"] = "Không có"
            else:                                    result["noi_that"] = value.strip()

        elif "hướng" in label and "ban công" not in label:
            result["huong_nha"] = value.strip()

        elif "ban công" in label:
            result["huong_ban_cong"] = value.strip()

    return result


def _parse_schema_json(soup) -> dict:
    """
    Parse <script type='application/ld+json'> RealEstateListing.
    Nguồn rất tin cậy (server-generated).
    Trả về: gia_ty, dien_tich, so_phong_ngu, so_phong_wc,
            phuong_schema, quan_schema, sdt_schema
    """
    result = {}
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            continue
        if data.get("@type") != "RealEstateListing":
            continue

        price_raw = data.get("offers", {}).get("price")
        if price_raw:
            try: result["gia_ty"] = round(float(price_raw) / 1_000_000_000, 2)
            except Exception: pass

        item = data.get("itemOffered", {})

        fs = item.get("floorSize", {}).get("value")
        if fs:
            try: result["dien_tich"] = float(fs)
            except Exception: pass

        nb = item.get("numberOfBedrooms")
        if nb:
            try: result["so_phong_ngu"] = int(nb)
            except Exception: pass

        nwc = item.get("numberOfBathroomsTotal")
        if nwc:
            try: result["so_phong_wc"] = int(nwc)
            except Exception: pass

        addr = item.get("address", {})
        ward = addr.get("addressLocality", "").strip()
        reg  = addr.get("addressRegion", "")
        dist = reg.split(",")[0].strip() if reg else ""
        if ward: result["phuong_schema"] = ward
        if dist: result["quan_schema"]   = dist

        tel = data.get("seller", {}).get("telephone", "")
        if tel: result["sdt_schema"] = tel.replace(" ", "")

        break
    return result


def _parse_current_data_js(soup) -> dict:
    """
    Parse biến JS: var currentData = {...};
    Trang luôn nhúng object này — rất đáng tin.
    Trả về: gia_ty, dien_tich, phuong_js, quan_js, ma_tin_js
    """
    result = {}
    for s in soup.find_all("script"):
        t = s.string or ""
        if "currentData" not in t:
            continue
        m = re.search(r"var\s+currentData\s*=\s*(\{.*?\});", t, re.S)
        if not m:
            continue
        try:
            cd    = json.loads(m.group(1))
            price = cd.get("Price")
            unit  = cd.get("PriceUnit", "")
            if price and unit == "tỷ":
                try: result["gia_ty"] = float(price)
                except Exception: pass
            area = cd.get("AreaValue")
            if area:
                try: result["dien_tich"] = float(area)
                except Exception: pass
            ward = cd.get("WardName", "").strip()
            dist = cd.get("DistrictName", "").strip()
            if ward: result["phuong_js"] = ward
            if dist: result["quan_js"]   = dist
            pid = cd.get("Id")
            if pid: result["ma_tin_js"] = str(pid)
        except Exception:
            pass
        break
    return result


def _parse_meta_dates(soup) -> dict:
    """
    Parse ngày đăng / ngày hết hạn / mã tin từ block:
    class='ui horizontal borderless segments mobile-display-none'
    Trả về: ngay_dang, ngay_het_han, ma_tin_meta
    """
    result = {}
    for seg in soup.find_all("div", class_=lambda c: c and "horizontal" in c and "segments" in c):
        txt = seg.get_text(" ", strip=True)
        if "Ngày đăng" not in txt:
            continue
        m = re.search(r"Ngày đăng\s*([\d/]+)\s*([\d:]+)", txt)
        if m: result["ngay_dang"] = f"{m.group(1)} {m.group(2)}"
        m = re.search(r"Ngày hết hạn\s*([\d/]+)\s*([\d:]+)", txt)
        if m: result["ngay_het_han"] = f"{m.group(1)} {m.group(2)}"
        m = re.search(r"Mã tin\s*(\d+)", txt)
        if m: result["ma_tin_meta"] = m.group(1)
        break
    return result


def _parse_sdt(soup, text: str) -> str | None:
    """
    Lấy SĐT: ưu tiên broker section (số đầy đủ),
    rồi onclick showMainPhoneNumber, cuối cùng regex toàn trang.
    """
    # 1. Broker section — div.phone-contact chứa số đầy đủ (không bị che ***)
    for a in soup.find_all("a", href=lambda h: h and "/nha-moi-gioi/" in h):
        ph = a.find("div", class_=lambda c: c and "phone-contact" in c)
        if ph:
            digits = re.sub(r"\D", "", ph.get_text())
            if len(digits) >= 9:
                return digits

    # 2. Tag có onclick showMainPhoneNumber — "0908 696 ***"
    for tag in soup.find_all(attrs={"onclick": re.compile(r"showMainPhoneNumber")}):
        t = tag.get_text(strip=True)
        m = re.search(r"([\d\s]{8,12})\s*\*+", t)
        if m:
            return re.sub(r"\D", "", m.group(1)) + "xxx"

    # 3. Regex toàn trang (fallback cuối)
    m = re.search(r"(\d{7,9})\s*\*+", text)
    if m: return m.group(1) + "xxx"
    m = re.search(r"\b(0[3-9]\d{8})\b", text)
    if m: return m.group(1)

    return None


# ══════════════════════════════════════════════════════════════════════════════
# HÀM TỔNG HỢP — PARSE TRANG CHI TIẾT
# ══════════════════════════════════════════════════════════════════════════════

def parse_detail(url: str) -> dict | None:
    """
    Crawl 1 trang chi tiết và trả về dict đầy đủ 26 trường.

    Chiến lược merge (thứ tự ưu tiên):
      feat (feature block HTML) > schema (JSON-LD) > jsdata (currentData JS) > title_data (fallback)
    """
    r = safe_get(url)
    if not r:
        return None

    soup = BeautifulSoup(r.text, "html.parser")
    text = soup.get_text(" ", strip=True)
    tl   = text.lower()

    h1    = soup.find("h1")
    title = clean(h1.text) if h1 else None

    url_info   = parse_url_slug(url)
    title_data = extract_from_title(title or "")

    # Detect bị block:
    #   Trang bình thường LUÔN có "Tài khoản: 0" trong navbar (login widget)
    #   → KHÔNG dùng chuỗi đó để detect block
    #   Thay vào đó: kiểm tra feature block hoặc currentData JS có tồn tại
    _has_feature = bool(soup.find("div", id="grid-realestate-feature"))
    _has_js_data = bool(re.search(r"var\s+currentData\s*=\s*\{", r.text))
    _has_h1      = bool(soup.find("h1"))
    page_ok = len(text) > 800 and (_has_feature or _has_js_data or _has_h1)

    # ── 4 nguồn có cấu trúc ─────────────────────────────────────────────────
    feat   = _parse_feature_block(soup)   if page_ok else {}
    schema = _parse_schema_json(soup)     if page_ok else {}
    jsdata = _parse_current_data_js(soup) if page_ok else {}
    meta   = _parse_meta_dates(soup)      if page_ok else {}

    def best(*keys):
        """Lấy giá trị đầu tiên khác None theo thứ tự: feat > schema > jsdata > title_data."""
        for src in (feat, schema, jsdata, title_data):
            for k in keys:
                v = src.get(k)
                if v is not None:
                    return v
        return None

    # ── C1: Giá ─────────────────────────────────────────────────────────────
    gia_ty = best("gia_ty")
    m = re.search(r"~?([\d,\.]+)\s*triệu\s*/\s*m", text, re.I)
    gia_per_m2 = m.group(1).replace(",", ".") if m else None

    # ── C1: Diện tích ────────────────────────────────────────────────────────
    dien_tich = best("dien_tich")

    # ── C2: Phòng ngủ / WC ──────────────────────────────────────────────────
    so_pn = best("so_phong_ngu")
    so_wc = best("so_phong_wc")
    wc_inf = False
    if so_pn and so_wc is None:
        so_wc  = max(1, so_pn - 1)
        wc_inf = True

    # ── C2: Nội thất ─────────────────────────────────────────────────────────
    noi_that = feat.get("noi_that") or title_data.get("noi_that")
    if not noi_that and page_ok:
        m2 = re.search(r"nội thất\s*(cơ bản|đầy đủ|cao cấp|không có|full)", tl)
        if m2:
            v = m2.group(1)
            noi_that = "Đầy đủ" if v == "full" else v.title()
        elif re.search(r"đầy đủ\s*nội thất|full\s*nội thất|nội thất\s*(đẹp|mới|xịn|cao)", tl):
            noi_that = "Đầy đủ"
        elif re.search(r"bàn giao\s*(hoàn thiện|đầy đủ|full)|hoàn thiện\s*nội thất", tl):
            noi_that = "Đầy đủ"
        elif re.search(r"bàn giao\s*(thô|cơ bản)|nhà\s*(thô|trống)|căn hộ\s*thô", tl):
            noi_that = "Không có"
        elif re.search(r"nhà\s*(mới|đẹp|xịn)", tl):
            noi_that = "Đầy đủ"

    # ── C2: Tầng ─────────────────────────────────────────────────────────────
    tang = title_data.get("tang")
    if not tang:
        m2 = re.search(r"(?:lầu|tầng)\s*(\d+)", tl)
        if m2: tang = int(m2.group(1))

    # ── C4: Pháp lý ──────────────────────────────────────────────────────────
    phap_ly = feat.get("phap_ly") or title_data.get("phap_ly")
    if not phap_ly and page_ok:
        if re.search(r"sổ\s*(đỏ|hồng)|shr\b|sổ\s*riêng|sổ\s*cầm\s*tay", tl):
            phap_ly = "Sổ đỏ/Sổ hồng"
        elif re.search(r"giấy tờ hợp lệ|hợp đồng mua bán|pháp lý\s*(rõ|đầy đủ|ok)", tl):
            phap_ly = "Giấy tờ hợp lệ"
        elif re.search(r"chưa có sổ|đang\s*(?:chờ|làm)\s*sổ", tl):
            phap_ly = "Chưa có sổ"

    # ── C5: Hạ tầng xã hội ───────────────────────────────────────────────────
    c5 = []
    if re.search(r"bệnh viện|\bbv\b", tl):                         c5.append("Bệnh viện")
    if re.search(r"trường học|các cấp|trường tiểu|trường thpt", tl): c5.append("Trường học")
    if re.search(r"chợ|siêu thị|vinmart|aeon|coopmart", tl):        c5.append("Chợ/Siêu thị")
    if re.search(r"metro|ga tàu|xe buýt", tl):                       c5.append("Metro/Bus")
    tien_ich_ha_tang = " | ".join(c5) if c5 else title_data.get("tien_ich_ha_tang")

    # ── C6: Tiện ích nội khu ──────────────────────────────────────────────────
    c6 = []
    if re.search(r"hồ bơi|bể bơi", tl):          c6.append("Hồ bơi")
    if re.search(r"\bgym\b|phòng gym", tl):        c6.append("Gym")
    if re.search(r"thang máy", tl):                c6.append("Thang máy")
    if re.search(r"bãi xe|hầm xe|parking", tl):   c6.append("Bãi xe")
    if re.search(r"bảo vệ 24|an ninh 24", tl):    c6.append("Bảo vệ 24/7")
    if DU_AN_TICH_RE.search(tl):
        for x in ("Hồ bơi", "Gym", "Bãi xe"):
            if x not in c6: c6.append(x)
    tien_ich_noi_khu = " | ".join(c6) if c6 else title_data.get("tien_ich_noi_khu")

    # ── C7: View ──────────────────────────────────────────────────────────────
    huong_view = title_data.get("huong_view")
    if not huong_view:
        if   re.search(r"view sông|nhìn sông", tl):        huong_view = "View sông"
        elif re.search(r"view công viên", tl):              huong_view = "View công viên"
        elif re.search(r"view thành phố|city view", tl):   huong_view = "View thành phố"
        elif re.search(r"căn góc|\d+\s*view|lô góc", tl):  huong_view = "Căn góc 2 view"

    # ── C8: Hướng nhà / ban công ──────────────────────────────────────────────
    huong_nha      = feat.get("huong_nha")      or title_data.get("huong_nha")
    huong_ban_cong = feat.get("huong_ban_cong") or title_data.get("huong_ban_cong")
    if not huong_nha:
        m2 = re.search(rf"hướng\s*(?:nhà|căn|căn hộ)?\s*:?\s*{HUONG_RE}", text, re.I)
        if m2: huong_nha = m2.group(1)
    if not huong_ban_cong:
        m2 = re.search(rf"ban\s*công\s*(?:hướng)?\s*:?\s*{HUONG_RE}", text, re.I)
        if m2: huong_ban_cong = m2.group(1)

    # ── SĐT ───────────────────────────────────────────────────────────────────
    sdt = _parse_sdt(soup, text) if page_ok else None

    # ── Phường / Quận ─────────────────────────────────────────────────────────
    phuong = (url_info.get("phuong")
              or jsdata.get("phuong_js")
              or schema.get("phuong_schema"))

    # ── Ngày / Mã tin ─────────────────────────────────────────────────────────
    ngay_dang    = meta.get("ngay_dang")
    ngay_het_han = meta.get("ngay_het_han")
    ma_tin = (url_info.get("ma_tin")
              or meta.get("ma_tin_meta")
              or jsdata.get("ma_tin_js"))

    return {
        "url":              url,
        "ma_tin":           ma_tin,
        "title":            title,
        "crawl_time":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ngay_dang":        ngay_dang,
        "ngay_het_han":     ngay_het_han,
        "sdt":              sdt,
        "dia_chi":          None,
        "phuong":           phuong,
        "location":         "TP.HCM",
        "gia_ty":           gia_ty,
        "gia_per_m2_trieu": gia_per_m2,
        "dien_tich":        dien_tich,
        "so_phong_ngu":     so_pn,
        "so_phong_wc":      so_wc,
        "wc_inferred":      wc_inf,
        "noi_that":         noi_that,
        "tang":             tang,
        "du_an":            url_info.get("du_an"),
        "du_an_hint":       title_data.get("du_an_hint"),
        "phap_ly":          phap_ly,
        "tien_ich_ha_tang": tien_ich_ha_tang,
        "tien_ich_noi_khu": tien_ich_noi_khu,
        "huong_view":       huong_view,
        "huong_nha":        huong_nha,
        "huong_ban_cong":   huong_ban_cong,
    }