# ApartmentBroker DSS

Hệ thống hỗ trợ ra quyết định chọn căn hộ tại TP.HCM bằng AHP, kết hợp pipeline dữ liệu bất động sản và lớp trợ lý LLM để giải thích kết quả rõ ràng hơn.

## Dự án này làm gì?

ApartmentBroker có 4 lớp chính:

1. Crawl dữ liệu căn hộ từ `thuviennhadat.vn`
2. Làm sạch, chuẩn hóa và đẩy dữ liệu vào PostgreSQL
3. Tính điểm AHP để xếp hạng căn hộ theo 8 tiêu chí
4. Dùng LLM để hỗ trợ người dùng ở các bước trước, trong và sau khi chạy AHP

Nói ngắn gọn: đây là một DSS cho bài toán "chọn căn hộ phù hợp để ở", không chỉ trả ra thứ hạng mà còn cố gắng giải thích vì sao kết quả như vậy.

## Các chức năng chính

### 1. Pipeline dữ liệu bất động sản

- Crawl danh sách và trang chi tiết căn hộ từ `thuviennhadat.vn`
- Parse nhiều nguồn dữ liệu trong HTML như feature block, JSON-LD, `currentData` JS và fallback từ title
- Tải ảnh listing về local để phục vụ UI
- Lưu dữ liệu thô vào `raw_data.csv`
- Làm sạch, lọc outlier, chuẩn hóa cột và xuất `cleaned_data.csv`
- Import/upsert vào PostgreSQL theo `ma_tin`

### 2. Xếp hạng căn hộ bằng AHP

- Hỗ trợ 8 tiêu chí:
  - `C1` Tài chính
  - `C2` Nội thất
  - `C3` Chủ đầu tư
  - `C4` Pháp lý
  - `C5` Hạ tầng xã hội
  - `C6` Tiện ích nội khu
  - `C7` Không gian sống/ngoại thất
  - `C8` Phong thủy/hướng nhà
- Có 2 chế độ dùng:
  - `Expert`: dùng sẵn bộ trọng số đã hiệu chỉnh
  - `Custom`: tự nhập ma trận so sánh cặp
- Tính `weights`, `lambda_max`, `CI`, `CR`
- Chỉ chấp nhận ma trận có `CR < 10%`
- Chấm điểm từng căn theo từng tiêu chí rồi tổng hợp thành điểm AHP cuối cùng

### 3. Lớp LLM hỗ trợ ra quyết định

Nếu nhìn theo hành trình người dùng, phần AI trong dự án được chia thành 3 cụm chính:

1. `AI intake` trước AHP  
   Người dùng mô tả nhu cầu bằng ngôn ngữ tự nhiên, hệ thống gợi ý preset và trọng số khởi đầu.

2. `AI insight` sau AHP  
   Sau khi AHP xếp hạng, AI diễn giải top căn hộ, tóm tắt trade-off và giải thích vì sao căn đứng đầu nổi bật hơn.

3. `AI tương tác sâu trên shortlist`  
   Khi người dùng cần đào sâu hơn, AI hỗ trợ:
   - so sánh 2-4 căn trong top 10
   - chat theo từng căn hộ cụ thể

Về mặt endpoint/code thì hiện có 4 route AI riêng:

- `POST /ahp/intake`
- `POST /ahp/score` với `llm_enabled=true`
- `POST /ahp/compare`
- `POST /ahp/chat-apartment`

## Kiến trúc tổng quan

```text
thuviennhadat.vn
    ↓
Crawler (DataTrans/data-crawling)
    ↓
raw/raw_data.csv + raw/images/
    ↓
Preprocessing (DataTrans/preprocessing)
    ↓
processed/cleaned_data.csv
    ↓
Import script (DataTrans/src/scripts/import_csv.py)
    ↓
PostgreSQL
    ↓
FastAPI backend (DataTrans/src)
    ↓
Vanilla frontend (Page/)
```

## Cấu trúc thư mục

```text
.
├─ DataTrans/
│  ├─ data-crawling/            # Crawler, parser, utils, raw CSV, raw images
│  ├─ preprocessing/            # Clean & enrich dữ liệu
│  ├─ src/
│  │  ├─ routers/               # API routes
│  │  ├─ services/              # AHP engine, OpenRouter services
│  │  ├─ scripts/               # Import CSV, refresh status
│  │  ├─ main.py                # FastAPI entrypoint
│  │  ├─ models.py              # SQLAlchemy models
│  │  ├─ schema.py              # Pydantic schemas căn hộ
│  │  └─ ahp_contracts.py       # Contracts cho AHP + LLM features
│  └─ requirements.txt
├─ Page/                        # HTML/CSS/JS giao diện
├─ Dockerfile
├─ docker-compose.yml
└─ README.md
```

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Backend API | FastAPI, Uvicorn |
| ORM / DB | SQLAlchemy, PostgreSQL, psycopg2 |
| Data processing | Pandas, NumPy |
| Crawling | Requests, BeautifulSoup, Selenium |
| Frontend | HTML, CSS, Vanilla JavaScript, Chart.js, KaTeX |
| LLM | OpenRouter |
| Container | Docker, Docker Compose |

## Cơ sở dữ liệu

Dự án đang dùng 3 bảng chính:

### `can_ho`

Lưu listing căn hộ đã chuẩn hóa:

- metadata tin đăng: `ma_tin`, `url`, `ngay_dang`, `ngay_het_han`
- dữ liệu media: `thumbnail_url`, `thumbnail_path`, `image_urls`, `image_local_paths`
- dữ liệu phục vụ AHP: `gia_ty`, `dien_tich`, `noi_that`, `phap_ly`, `tien_ich_*`, `huong_*`
- trạng thái: `trang_thai`, `created_at`, `updated_at`

### `ahp_session`

Lưu một lần chạy AHP:

- tên phiên
- ma trận so sánh cặp
- trọng số
- chỉ số nhất quán: `lambda_max`, `ci`, `cr`, `cr_ok`
- metadata AI: `llm_model`, `llm_status`, `llm_output`, `llm_error`, `llm_generated_at`

### `ahp_result`

Lưu kết quả xếp hạng của từng căn trong một session:

- `session_id`
- `canho_id`
- `ahp_score`
- `rank`
- `score_detail`

## Luồng dữ liệu chi tiết

### Bước 1. Crawl dữ liệu thô

File chính: `DataTrans/data-crawling/main.py`

Crawler:

- lấy link listing từ trang danh sách
- vào từng trang chi tiết để parse dữ liệu
- tải ảnh về `DataTrans/data-crawling/raw/images/<ma_tin>/`
- checkpoint dữ liệu sau mỗi trang vào `raw/raw_data.csv`

Parser ở `DataTrans/data-crawling/parsers.py` cố gắng lấy dữ liệu từ nhiều nguồn theo thứ tự ưu tiên:

1. block HTML mô tả đặc điểm bất động sản
2. JSON-LD (`application/ld+json`)
3. biến JS `currentData`
4. fallback từ title khi trang bị thiếu dữ liệu

### Bước 2. Làm sạch và chuẩn hóa

File chính: `DataTrans/preprocessing/clean_and_enrich.py`

Script này:

- giữ lại tập cột cần thiết
- làm sạch title
- ép kiểu số cho giá, diện tích, số phòng
- drop bản ghi thiếu giá hoặc diện tích
- fill các giá trị thiếu bằng mặc định hợp lý
- thêm `trang_thai`, `created_at`, `updated_at`
- loại outlier cơ bản theo giá, diện tích, số phòng
- xuất ra `processed/cleaned_data.csv`

### Bước 3. Import vào PostgreSQL

File chính: `DataTrans/src/scripts/import_csv.py`

Script import:

- đọc `cleaned_data.csv`
- parse ngày, số, list ảnh
- xác định `trang_thai` từ `ngay_het_han`
- upsert theo `ma_tin`
- commit định kỳ mỗi 50 dòng

### Bước 4. Cập nhật trạng thái tin đăng

File: `DataTrans/src/scripts/update_status.py`

Script này bật/tắt `trang_thai` dựa trên `ngay_het_han`.

## AHP hoạt động như thế nào trong dự án này?

File chính: `DataTrans/src/services/ahp_engine.py`

### 1. Tính trọng số tiêu chí

Hàm `calc_weights(matrix)`:

- chuẩn hóa ma trận theo cột
- lấy trung bình từng hàng để ra `weights`
- tính `lambda_max`
- tính `CI` và `CR`
- xác nhận ma trận có đủ nhất quán hay không

### 2. Chấm điểm từng căn hộ

Hàm `score_canho(ch, weights)`:

- mỗi tiêu chí có một hàm điểm riêng từ `0.0` đến `1.0`
- ví dụ:
  - giá thấp hơn thì điểm tài chính tốt hơn
  - pháp lý rõ hơn thì điểm cao hơn
  - nhiều tiện ích hơn thì điểm cao hơn
  - hướng nhà phù hợp hơn thì điểm phong thủy tốt hơn

### 3. Tổng hợp thành điểm AHP

Điểm cuối cùng của một căn:

```text
AHP score = Σ(weight_i × score_i)
```

Sau đó backend sắp xếp giảm dần để lấy thứ hạng.

## 3 cụm tính năng LLM cần biết

## 1. AI Intake

Route: `POST /ahp/intake`  
Service: `DataTrans/src/services/intake_openrouter_service.py`

Mục tiêu:

- nhận mô tả nhu cầu ở thực bằng tiếng Việt
- tóm tắt nhu cầu thành `intent_profile`
- gợi ý preset khởi đầu như `balanced`, `price`, `quality`, `legal`, `location`
- đề xuất trọng số ban đầu cho 8 tiêu chí

Ý nghĩa nghiệp vụ:

- giúp người dùng không phải tự nghĩ ma trận ngay từ đầu
- biến mô tả tự nhiên thành cấu hình AHP ban đầu dễ chỉnh tay

## 2. AI Insight sau khi chạy AHP

Route: `POST /ahp/score`  
Service: `DataTrans/src/services/openrouter_service.py`

Sau khi backend xếp hạng xong, hệ thống gửi top 10 sang LLM để:

- tóm tắt toàn cảnh shortlist
- giải thích vì sao căn đứng đầu hợp lý
- nêu trade-off giữa các lựa chọn
- trả thêm `llm_support_score`, `strengths`, `risks`, `criterion_scores` cho từng căn

Điểm quan trọng:

- AHP vẫn là lớp quyết định chính
- LLM chỉ đóng vai trò diễn giải và hỗ trợ đọc kết quả

## 3. AI Tương Tác Sâu

### 3a. So sánh nhiều căn

Route: `POST /ahp/compare`  
Service: `DataTrans/src/services/compare_openrouter_service.py`

Mục tiêu:

- so sánh 2-4 căn trong top 10 của một session AHP
- đưa ra căn phù hợp hơn để ở
- mô tả strengths, risks, trade-offs theo nhu cầu ở thực

### 3b. Chat theo từng căn hộ

Route: `POST /ahp/chat-apartment`  
Service: `DataTrans/src/services/apartment_chat_openrouter_service.py`

Mục tiêu:

- trả lời câu hỏi xoay quanh đúng căn hộ đang xem
- dùng context của session AHP và top context liên quan
- từ chối câu hỏi ngoài phạm vi căn hộ

Ví dụ câu hỏi phù hợp:

- căn này hợp để ở điểm nào?
- khi đi xem thực tế nên kiểm tra gì?
- pháp lý và tiện ích của căn này có gì cần lưu ý?

## Cơ chế OpenRouter

Logic gọi model tập trung ở `DataTrans/src/services/openrouter_client.py`.

Hiện hệ thống hỗ trợ:

- model mặc định qua `OPENROUTER_DEFAULT_MODEL`
- danh sách fallback qua `OPENROUTER_FALLBACK_MODELS`
- tự thử model tiếp theo khi gặp timeout, `429`, lỗi upstream hoặc `5xx`

## API chính

### Frontend / health

- `GET /`
- `GET /home`
- `GET /guide`
- `GET /ahp`
- `GET /api-info`

### Căn hộ

- `GET /canho/list`
- `GET /canho/{id}`

### AHP + LLM

- `POST /ahp/intake`
- `POST /ahp/score`
- `POST /ahp/compare`
- `POST /ahp/chat-apartment`
- `GET /ahp/sessions`
- `GET /ahp/sessions/{session_id}`

Swagger UI có tại:

```text
http://localhost:8000/docs
```

## Giao diện người dùng

Frontend nằm ở thư mục `Page/`, trọng tâm là:

- `index.html`: landing page
- `guide.html`: trang giải thích AHP
- `ahp.html`: giao diện phân tích chính
- `ahp.js`: toàn bộ logic gọi API, dựng ma trận, biểu đồ, modal, compare và chat

UI AHP hiện có:

- chọn chế độ `Expert` hoặc `Custom`
- AI intake để gợi ý cấu hình ban đầu
- chạy AHP và xem top căn hộ
- xem decision dossier
- xem `AI insight`
- so sánh nhiều căn bằng AI
- chat theo từng căn hộ

## Chạy dự án bằng Docker

### 1. Tạo file `.env` ở root repo

Ví dụ:

```env
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_DEFAULT_MODEL=qwen/qwen3-next-80b-a3b-instruct:free
```

`DATABASE_URL` đã được set sẵn trong `docker-compose.yml` cho môi trường container.

### 2. Build và chạy

```bash
docker compose up --build
```

### 3. Truy cập

- App: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- API info: `http://localhost:8000/api-info`

## Chạy local không dùng Docker

### 1. Tạo môi trường

```bash
cd DataTrans
python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

### 2. Cài dependencies

```bash
pip install -r requirements.txt
```

### 3. Chuẩn bị `.env` ở root repo

Ví dụ:

```env
DATABASE_URL=postgresql://postgres:123@localhost:5432/DSS
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_DEFAULT_MODEL=qwen/qwen3-next-80b-a3b-instruct:free
```

### 4. Chạy backend

```bash
cd DataTrans/src
uvicorn main:app --reload --port 8000
```

## Chạy pipeline dữ liệu thủ công

### 1. Crawl

```bash
cd DataTrans/data-crawling
python main.py --pages 5
python main.py --pages 10 --fresh
```

Output:

- `DataTrans/data-crawling/raw/raw_data.csv`
- `DataTrans/data-crawling/raw/images/`

### 2. Làm sạch

```bash
cd DataTrans/preprocessing
python clean_and_enrich.py
```

Output:

- `DataTrans/preprocessing/processed/cleaned_data.csv`

### 3. Import DB

```bash
cd DataTrans/src
python scripts/import_csv.py --default
```

Hoặc:

```bash
python scripts/import_csv.py --csv ../preprocessing/processed/cleaned_data.csv
```

### 4. Refresh trạng thái tin

```bash
python scripts/update_status.py
```

## Auto pipeline trong runtime

Một chi tiết đáng chú ý:

- route `POST /ahp/score` có gọi `background_tasks.add_task(run_data_pipeline)`
- `run_data_pipeline()` sẽ chỉ chạy lại crawl → clean → import nếu dữ liệu hiện tại bị coi là cũ
- tiêu chí "fresh" hiện dựa vào `updated_at` của bản ghi mới nhất và ngưỡng 168 giờ

Nghĩa là dự án có cả:

- pipeline thủ công cho dev/data
- pipeline nền khi người dùng chạy AHP

## Test

Các test hiện có tập trung vào:

- router AHP
- services OpenRouter
- logic UI cho phần LLM summary
- media resolver

Chạy test:

```bash
cd DataTrans
python -m pytest src/tests
```

## Một số lưu ý khi đọc code

- `schema.py` và `ahp_contracts.py` đang cùng tồn tại:
  - `schema.py` tập trung vào schema căn hộ/session cơ bản
  - `ahp_contracts.py` là contract mới hơn cho AHP + compare + chat + intake + llm analysis
- `Page/ahp.js` là file rất lớn, đang ôm hầu hết logic UI ở một chỗ
- `data_pipeline.py` giúp nối crawler, preprocessing và import lại thành một luồng
- `media_resolver.py` là lớp quan trọng để ảnh local và ảnh remote hiển thị thống nhất trên UI

## Hướng mở rộng hợp lý

- tách `ahp.js` thành module nhỏ hơn
- thêm migration/schema management rõ ràng hơn thay vì `ensure_canho_schema()`
- thêm scheduler riêng cho pipeline thay vì gắn vào background task của `/ahp/score`
- thêm benchmark/monitor cho chất lượng crawl
- thêm test integration đầy đủ cho các route FastAPI

## Tóm tắt nhanh

ApartmentBroker không chỉ là một app xếp hạng căn hộ. Đây là một hệ thống gồm:

- pipeline dữ liệu bất động sản
- engine AHP 8 tiêu chí
- FastAPI backend + PostgreSQL
- frontend trực quan hóa kết quả
- lớp LLM hỗ trợ ra quyết định ở nhiều bước

Nếu bạn muốn đọc code theo thứ tự dễ hiểu nhất, mình khuyên:

1. `DataTrans/src/main.py`
2. `DataTrans/src/routers/ahp.py`
3. `DataTrans/src/services/ahp_engine.py`
4. `DataTrans/src/services/*openrouter*.py`
5. `Page/ahp.html`
6. `Page/ahp.js`
7. `DataTrans/data-crawling/*`
8. `DataTrans/preprocessing/clean_and_enrich.py`
9. `DataTrans/src/scripts/import_csv.py`
