"""
FastAPI entry point.
Run with: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import Base, engine, ensure_canho_schema, settings
from routers import ahp, canho

BASE_DIR = Path(__file__).resolve().parent
PAGE_DIR = BASE_DIR.parent.parent / "Page"
MEDIA_DIR = BASE_DIR.parent / "data-crawling" / "raw" / "images"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)
ensure_canho_schema()

app = FastAPI(
    title="DSS Can Ho TP.HCM",
    description="He ho tro ra quyet dinh chon can ho - AHP + PostgreSQL",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],
    allow_origin_regex=r".*",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.mount("/static", StaticFiles(directory=str(PAGE_DIR)), name="static")
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/", tags=["Frontend"])
def serve_home():
    return FileResponse(str(PAGE_DIR / "index.html"))


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
        "docs": "/docs",
        "routes": ["/canho/list", "/canho/{id}", "/ahp/intake", "/ahp/score", "/ahp/sessions"],
        "llm_default_model": settings.OPENROUTER_DEFAULT_MODEL,
        "llm_enabled": bool(settings.OPENROUTER_API_KEY),
    }
