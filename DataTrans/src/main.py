"""
main.py — Entry point FastAPI
Chạy: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  
from fastapi.responses import FileResponse
from pathlib import Path


from database import engine, Base
from routers import canho, ahp

BASE_DIR = Path(__file__).resolve().parent
PAGE_DIR = BASE_DIR.parent.parent / "Page"
print(f"--- Kiểm tra đường dẫn Page: {PAGE_DIR} ---")
# Tạo bảng tự động nếu chưa có
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DSS Căn Hộ TP.HCM",
    description="Hệ hỗ trợ ra quyết định chọn căn hộ — AHP + PostgreSQL",
    version="1.0.0",
)

# CORS: cho phép mọi origin bao gồm file:// (origin = "null") và localhost
# Khi mở file HTML trực tiếp, browser gửi Origin: null
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],   # "null" = mở file:// trực tiếp trên trình duyệt
    allow_origin_regex=r".*",      # fallback regex cho mọi origin
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# 1. Mount thư mục 'Page' để FastAPI hiểu các file .js, .css bên trong
# 'directory' phải đúng đường dẫn tới thư mục Page (tính từ file main.py)
# Dựa theo hình của bạn, Page nằm cùng cấp với thư mục src/ hoặc ngay trong src/
# Nếu bạn chạy lệnh từ thư mục 'src', hãy để directory="../Page" hoặc "Page" tùy vị trí thực tế
app.mount("/static", StaticFiles(directory=str(PAGE_DIR)), name="static")

@app.get("/", tags=["Frontend"])
def serve_home():
    html_path = PAGE_DIR / "index.html"
    return FileResponse(str(html_path))

@app.get("/home", tags=["Frontend"])
def serve_index():
    return FileResponse(str(PAGE_DIR / "index.html"))

@app.get("/ahp", tags=["Frontend"])
def serve_ahp():
    return FileResponse(str(PAGE_DIR / "ahp.html"))

@app.get("/guide", tags=["Frontend"])
def serve_guide():
    return FileResponse(str(PAGE_DIR / "guide.html"))


app.include_router(canho.router)
app.include_router(ahp.router)


@app.get("/api-info", tags=["Health"])
def api_info():
    return {
        "status": "ok",
        "docs":   "/docs",
        "routes": ["/canho/list", "/canho/{id}", "/ahp/score", "/ahp/sessions"],
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
