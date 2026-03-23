DepartAHP - Hệ thống hỗ trợ ra quyết định chọn căn hộ tại TP.HCM
1. Giới thiệu dự án

DepartAHP là một dự án kết hợp giữa Data Engineering và Decision Support System (DSS) cho bài toán lựa chọn căn hộ tại TP.HCM.

Hệ thống này thực hiện các chức năng chính sau:

Thu thập dữ liệu căn hộ từ website bất động sản
Làm sạch và chuẩn hóa dữ liệu
Lưu dữ liệu vào PostgreSQL
Cung cấp API bằng FastAPI để truy vấn và tính điểm AHP
Cung cấp giao diện web để người dùng thao tác và xem kết quả xếp hạng căn hộ

Mục tiêu của dự án là hỗ trợ người dùng đánh giá và xếp hạng căn hộ dựa trên nhiều tiêu chí như tài chính, nội thất, pháp lý, tiện ích, vị trí, phong thủy và các yếu tố khác.

2. Kiến trúc tổng quát

Dự án gồm 4 phần chính:

2.1. Data Crawling

Thu thập dữ liệu thô từ nguồn web bất động sản và lưu thành file CSV.

2.2. Data Preprocessing

Làm sạch dữ liệu đã crawl, chuẩn hóa các cột cần thiết, bổ sung thông tin phục vụ xếp hạng.

2.3. Database

Lưu dữ liệu đã xử lý vào PostgreSQL để phục vụ backend API.

2.4. Backend + Frontend
Backend dùng FastAPI để cung cấp API
Frontend dùng HTML/CSS/JavaScript để hiển thị giao diện
Người dùng tương tác với giao diện, nhập trọng số AHP hoặc dùng trọng số chuyên gia, sau đó hệ thống tính toán và trả về kết quả xếp hạng
3. Cấu trúc thư mục
DepartAHP/
├── DataTrans/
│   ├── data-crawling/          # Crawl dữ liệu thô
│   ├── preprocessing/          # Làm sạch và chuẩn hóa dữ liệu
│   ├── src/                    # FastAPI, database, logic AHP, scripts
│   ├── requirements.txt        # Danh sách thư viện Python
│   └── setup.txt               # Ghi chú cài đặt nhanh
├── Page/                       # Frontend HTML/CSS/JS
├── crawl-data-sample.csv       # File dữ liệu mẫu (nếu có)
├── Dockerfile                  # Cấu hình build app bằng Docker
├── docker-compose.yml          # Chạy app + database bằng Docker
└── README.md
4. Công nghệ sử dụng
Python
FastAPI
PostgreSQL
SQLAlchemy
Pandas
Uvicorn
HTML / CSS / JavaScript
Docker / Docker Compose
5. Điều kiện cần trước khi chạy

Trước khi bắt đầu, cần cài:

5.1. Nếu chạy theo cách thông thường
Python 3.10 hoặc 3.11
pip
PostgreSQL
VS Code hoặc IDE bất kỳ
5.2. Nếu chạy bằng Docker
Docker Desktop
Docker Compose

Khuyến nghị với người mới: nên chạy bằng Docker vì dễ đồng bộ môi trường hơn.

6. Cách chạy dự án bằng Docker

Phần này dành cho người mới. Đây là cách dễ nhất để chạy hệ thống.

6.1. Bước 1: Clone project

Mở terminal hoặc Git Bash:

git clone https://github.com/Suchisixx/ahp-for-department.git
cd ahp-for-department
6.2. Bước 2: Kiểm tra file docker-compose.yml

File này dùng để chạy đồng thời:

PostgreSQL
FastAPI app

Ví dụ cấu hình:

version: "3.9"

services:
  db:
    image: postgres:15
    container_name: departahp-db
    environment:
      POSTGRES_DB: DSS
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    container_name: departahp-app
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:123@db:5432/DSS
    ports:
      - "8000:8000"

volumes:
  postgres_data:

Lưu ý:

db là tên service PostgreSQL trong Docker
app là backend FastAPI
DATABASE_URL phải dùng hostname db, không dùng localhost
6.3. Bước 3: Kiểm tra file Dockerfile

Ví dụ:

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY DataTrans/requirements.txt /app/DataTrans/requirements.txt
RUN pip install --no-cache-dir -r /app/DataTrans/requirements.txt

COPY . /app

WORKDIR /app/DataTrans/src

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

Giải thích ngắn:

Dùng Python 3.11
Cài thư viện từ requirements.txt
Copy toàn bộ source code vào container
Chạy FastAPI bằng Uvicorn ở cổng 8000
6.4. Bước 4: Kiểm tra requirements.txt

Trong file DataTrans/requirements.txt, cần có đầy đủ các package cần thiết, ví dụ:

pandas
numpy
sqlalchemy
psycopg2-binary
requests
beautifulsoup4
selenium
schedule
python-dotenv
loguru
fastapi
uvicorn[standard]
pytest
jupyter
ipykernel
flask
flask-cors
lxml
webdriver-manager
pydantic-settings

Nếu thiếu pydantic-settings, app có thể báo lỗi:

ModuleNotFoundError: No module named 'pydantic_settings'
6.5. Bước 5: Build và chạy Docker

Tại thư mục gốc project, chạy:

docker compose up --build

Ý nghĩa:

up: chạy container
--build: build lại image từ đầu

Nếu muốn dừng:

docker compose down

Nếu muốn chạy lại sau khi sửa code:

docker compose down
docker compose up --build
6.6. Bước 6: Mở ứng dụng

Sau khi chạy thành công, mở trình duyệt:

http://localhost:8000

Tài liệu API:

http://localhost:8000/docs

Health check:

http://localhost:8000/health

Lưu ý:

Trong log có thể hiện 0.0.0.0:8000
Nhưng khi mở trình duyệt trên máy cá nhân, bạn vẫn dùng localhost:8000
7. Cách chạy dự án không dùng Docker

Phần này dành cho trường hợp muốn chạy thủ công.

7.1. Bước 1: Tạo môi trường ảo

Đi tới thư mục DataTrans:

cd DataTrans
python -m venv venv

Kích hoạt môi trường ảo trên Windows PowerShell:

.\venv\Scripts\Activate.ps1

Nếu dùng Command Prompt:

venv\Scripts\activate
7.2. Bước 2: Cài thư viện
pip install -r requirements.txt
7.3. Bước 3: Cấu hình PostgreSQL

Tạo database tên DSS.

Ví dụ trong PostgreSQL:

Username: postgres
Password: 123
Database: DSS

Thiết lập biến môi trường hoặc file .env:

DATABASE_URL=postgresql://postgres:123@localhost:5432/DSS

Lưu ý:

Nếu chạy local, có thể dùng localhost
Nếu chạy Docker Compose, phải dùng db
7.4. Bước 4: Chạy backend

Di chuyển vào thư mục:

cd src
python -m uvicorn main:app --reload --port 8000

Sau đó mở:

http://localhost:8000
http://localhost:8000/docs
8. Quy trình dữ liệu

Đây là phần quan trọng nhất của dự án.

Dữ liệu đi qua 3 bước chính:

Crawl dữ liệu thô
Làm sạch dữ liệu
Import dữ liệu vào PostgreSQL

Sau đó backend dùng dữ liệu trong database để xếp hạng căn hộ.

8.1. Bước 1: Crawl dữ liệu thô

Di chuyển vào thư mục:

cd DataTrans/data-crawling

Chạy crawl 10 trang:

python main.py --pages 10

Nếu muốn crawl lại từ đầu:

python main.py --pages 20 --fresh

Kết quả thường được lưu tại:

DataTrans/data-crawling/raw/raw_data.csv

Mục đích của bước này:

lấy dữ liệu bài đăng căn hộ
lưu thông tin ban đầu vào file CSV thô
8.2. Bước 2: Làm sạch và chuẩn hóa dữ liệu

Di chuyển vào thư mục:

cd DataTrans/preprocessing

Chạy script làm sạch:

python clean_and_enrich.py

Kết quả sẽ được lưu tại:

DataTrans/preprocessing/processed/cleaned_data.csv

Bước này có thể bao gồm:

loại bỏ dữ liệu trùng lặp
loại bỏ dòng thiếu giá hoặc diện tích
chuẩn hóa giá tiền
chuẩn hóa diện tích
suy luận hoặc làm giàu dữ liệu bổ sung

Nếu file cleaned_data.csv rỗng hoặc chỉ có header, cần kiểm tra lại bước crawl hoặc logic lọc dữ liệu trong bước clean.