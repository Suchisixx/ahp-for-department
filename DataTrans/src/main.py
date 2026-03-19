"""
main.py — Entry point FastAPI
Chạy: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import canho, ahp

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

app.include_router(canho.router)
app.include_router(ahp.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "docs":   "/docs",
        "routes": ["/canho/list", "/canho/{id}", "/ahp/score", "/ahp/sessions"],
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}