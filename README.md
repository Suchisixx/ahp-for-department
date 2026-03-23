# DepartAHP - Hệ thống hỗ trợ ra quyết định chọn căn hộ tại TP.HCM

**DepartAHP** là một hệ thống **Decision Support System (DSS)** sử dụng phương pháp **AHP (Analytic Hierarchy Process)** kết hợp với **Data Engineering**, giúp người dùng đánh giá và xếp hạng các căn hộ, nhà phố, biệt thự tại TP.HCM dựa trên nhiều tiêu chí quan trọng.

### Các chức năng chính
- Thu thập (crawl) dữ liệu bất động sản từ các website uy tín
- Làm sạch, chuẩn hóa và làm giàu dữ liệu (enrich)
- Lưu trữ dữ liệu vào **PostgreSQL**
- Cung cấp **REST API** bằng **FastAPI** để truy vấn và tính điểm AHP
- Giao diện web đơn giản (HTML/CSS/JS) cho phép:
  - Nhập trọng số các tiêu chí (hoặc sử dụng trọng số mặc định của chuyên gia)
  - Xem kết quả xếp hạng căn hộ theo thứ tự ưu tiên

**Tiêu chí đánh giá mẫu**:  
Tài chính · Vị trí · Tiện ích · Nội thất · Pháp lý · Phong thủy · Giao thông · Tiềm năng tăng giá · An ninh · Cộng đồng cư dân · ...

---

## Kiến trúc tổng quan
Crawler → Raw CSV ──► Preprocessing ──► Cleaned CSV ──► PostgreSQL
│
FastAPI Backend
│
Web Frontend (HTML-CSS-JS)


---

## Cấu trúc thư mục dự án
DepartAHP/
├── DataTrans/
│   ├── data-crawling/          # Scripts thu thập dữ liệu thô
│   ├── preprocessing/          # Làm sạch, chuẩn hóa, làm giàu dữ liệu
│   ├── src/                    # FastAPI app, logic AHP, kết nối DB, scripts import
│   ├── requirements.txt        # Danh sách thư viện Python
│   └── setup.txt               # Ghi chú cài đặt nhanh (tùy chọn)
├── Page/                       # Frontend: HTML, CSS, JavaScript
├── crawl-data-sample.csv       # Dữ liệu mẫu (nếu có commit)
├── Dockerfile
├── docker-compose.yml
└── README.md

---

## Công nghệ sử dụng

| Phần              | Công nghệ chính                              |
|-------------------|----------------------------------------------|
| Backend           | Python 3.10+ · FastAPI · Uvicorn             |
| Database          | PostgreSQL · SQLAlchemy                      |
| Data Processing   | Pandas · NumPy                               |
| Crawling          | Requests · BeautifulSoup4 · Selenium         |
| Frontend          | HTML5 · CSS3 · Vanilla JavaScript            |
| Container         | Docker · Docker Compose                      |
| Khác              | python-dotenv · loguru · pydantic-settings   |

---

## Yêu cầu hệ thống

### Cách 1 – Khuyến nghị (dễ nhất cho người mới): Dùng Docker

- Docker Desktop (đã tích hợp Docker Compose)
- Git

### Cách 2 – Chạy thủ công (local)

- Python 3.10 hoặc 3.11
- PostgreSQL (local hoặc cloud)
- pip + virtualenv
- IDE (khuyên dùng VS Code)

---

## Cách chạy nhanh nhất bằng Docker (khuyến nghị)

1. Clone repository

```bash
git clone https://github.com/Suchisixx/ahp-for-department.git
cd ahp-for-department
```
(Tùy chọn) Kiểm tra/sửa thông tin đăng nhập DB trong docker-compose.yml

YAMLenvironment:
  POSTGRES_DB: DSS
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: 123

Build và chạy toàn bộ hệ thống

Bashdocker compose up --build

Truy cập


Giao diện web: http://localhost:8000
Tài liệu API (Swagger): http://localhost:8000/docs
Health check: http://localhost:8000/health

Dừng hệ thống:
Bashdocker compose down

Cách chạy thủ công (không dùng Docker)

Tạo và kích hoạt môi trường ảo

Bashcd DataTrans
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows CMD
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

Cài đặt dependencies

Bashpip install -r requirements.txt

Chuẩn bị PostgreSQL

Tạo database tên DSS (user: postgres, password: 123 hoặc tùy chỉnh)
Tạo file .env trong thư mục DataTrans/src (hoặc set biến môi trường):
textDATABASE_URL=postgresql://postgres:123@localhost:5432/DSS

Chạy backend

Bashcd src
uvicorn main:app --reload --port 8000
→ Mở trình duyệt: http://localhost:8000/docs

### Quy trình xử lý dữ liệu (bắt buộc trước khi dùng tính năng xếp hạng)
Bước 1: Crawl dữ liệu thô
Bashcd DataTrans/data-crawling
python main.py --pages 10               # crawl 10 trang
# Hoặc crawl lại từ đầu:
python main.py --pages 15 --fresh
→ Kết quả lưu tại: DataTrans/data-crawling/raw/raw_data.csv
Bước 2: Làm sạch & chuẩn hóa dữ liệu
Bashcd DataTrans/preprocessing
python clean_and_enrich.py
→ Kết quả lưu tại: DataTrans/preprocessing/processed/cleaned_data.csv
Lưu ý: Nếu file cleaned rỗng → kiểm tra lại bước crawl hoặc logic lọc trong script clean.
Bước 3: Import dữ liệu vào PostgreSQL
Bashcd DataTrans/src
python scripts/import_csv.py --default
# Hoặc chỉ định file cụ thể:
python scripts/import_csv.py --csv ../preprocessing/processed/cleaned_data.csv
Sau bước này, dữ liệu đã sẵn sàng để backend truy vấn và tính AHP.

Đóng góp & hướng phát triển

Cải thiện crawler (chống block, thêm nguồn dữ liệu mới)
Mở rộng bộ tiêu chí AHP + hỗ trợ trọng số động
Nâng cấp frontend (React / Vue / Tailwind nếu muốn giao diện đẹp hơn)
Thêm tính năng lưu lịch sử xếp hạng cá nhân
Tích hợp bản đồ (Google Maps / OpenStreetMap)
Thêm bộ lọc nâng cao (giá, diện tích, số phòng ngủ, ...)

text
