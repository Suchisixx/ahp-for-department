# DepartAHP — DSS Căn Hộ TP.HCM

Dự án này là một **Data Engineering + Decision Support System (DSS)** cho thị trường căn hộ tại TP.HCM.

Nó bao gồm:

- 🔍 **Crawler**: tự động lấy dữ liệu từ thuviennhadat.vn (bất động sản) và lưu thành CSV.
- 🧹 **Preprocessing**: làm sạch, chuẩn hóa dữ liệu (với Pandas).
- 🗄️ **Database**: import dữ liệu đã làm sạch vào PostgreSQL.
- 📊 **Backend API**: FastAPI cung cấp API để lọc/sort căn hộ và tính **AHP** (Analytic Hierarchy Process).
- 🌐 **Frontend**: HTML/JS (triển khai nhanh so who need a framework !?) để tương tác với API và hiển thị kết quả xếp hạng.

---

## 📁 Cấu trúc thư mục chính

```
DepartAHP/
├── DataTrans/              # Backend + data pipeline
│   ├── data-crawling/      # Crawler (thu thập dữ liệu)
│   ├── preprocessing/      # Clean + enrich dữ liệu
│   ├── src/                # API FastAPI + DB + AHP
│   ├── requirements.txt    # Thư viện Python cần cài
│   └── setup.txt           # Hướng dẫn nhanh (chạy server)
├── Page/                   # Frontend HTML/JS để tương tác với API
└── crawl-data-sample.csv   # Ví dụ dữ liệu mẫu (nếu có)
```

---

## 🚀 Bắt đầu (Quickstart)

### 1) Cài Python + virtualenv (tùy chọn nếu bạn muốn môi trường ảo)

```powershell
cd D:\HHTRQD\DepartAHP\DataTrans
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2) Cài dependencies

```powershell
pip install -r requirements.txt
```

### 3) Cấu hình PostgreSQL

1. Tạo database (ví dụ `DSS`).
2. Thiết lập biến môi trường `DATABASE_URL` (hoặc chỉnh trực tiếp file `.env` trong `DataTrans`).

Ví dụ `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/DSS
```

> ⚠️ **Lưu ý:** file `.env` hiện tại chỉ có dòng bật venv. Bạn nên cập nhật lại để `DATABASE_URL` đúng.

### 4) Chạy database + backend

```powershell
cd DataTrans\src
python -m uvicorn main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 5) Mở frontend (giao diện AHP)

Mở file `Page/ahp.html` bằng trình duyệt (double-click) rồi nhập các tham số AHP.

> 🔎 Frontend kết nối tới `http://localhost:8000` nên cần chạy backend trước.

---

## 🧱 Data pipeline (crawl → clean → import)

### 1) Crawl dữ liệu (thu thập dữ liệu thô)

```powershell
cd DataTrans\data-crawling
python main.py --pages 10      # crawl 10 trang
python main.py --pages 20 --fresh  # crawl lại từ đầu
```

Kết quả: `DataTrans/data-crawling/raw/raw_data.csv`

### 2) Clean & enrich dữ liệu

```powershell
cd DataTrans\preprocessing
python clean_and_enrich.py
```

Kết quả: `DataTrans/preprocessing/processed/cleaned_data.csv`

### 3) Import dữ liệu vào PostgreSQL

```powershell
cd DataTrans\src
python scripts/import_csv.py --default
```

> Nếu dùng đường dẫn khác, dùng `--csv <đường dẫn>`

---

## 🧠 API chính (FastAPI)

| Endpoint | Mô tả |
|---------|-------|
| `GET /canho/list` | Lấy danh sách căn hộ (filter + paging) |
| `GET /canho/{id}` | Lấy chi tiết 1 căn hộ |
| `POST /ahp/score` | Tính AHP, xếp hạng căn hộ, lưu session |
| `GET /ahp/sessions` | Lấy lịch sử phiên AHP |
| `GET /ahp/sessions/{id}` | Lấy chi tiết phiên AHP |

---

## 🔧 Cập nhật dữ liệu tự động khi gọi AHP

Backend đã thiết kế để tự động chạy toàn bộ pipeline (crawl → clean → import) khi gọi `POST /ahp/score`, nếu dữ liệu hiện tại cũ hơn 1 tiếng.

---

## 🧩 Gợi ý cải thiện

- Tách cấu hình `DATABASE_URL` ra `.env` đúng chuẩn (hiện đang bị lẫn lệnh kích hoạt venv).
- Triển khai scheduler (cron/task) để crawl định kỳ.
- Mở rộng crawler cho nhiều khu vực/loại hình (nhà phố, đất nền…).

---

Nếu cần mình bổ sung thêm phần hướng dẫn cụ thể (chạy release, deploy lên server, kết nối Docker, CI/CD...), cứ nói nhé!