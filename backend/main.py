import logging
import sys
from pathlib import Path

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import create_tables
from backend.routers import research, templates, content, amplification, metrics, languages, videos

app = FastAPI(
    title="Siete Marketing Engine",
    description="AI-powered B2B content marketing engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(languages.router, prefix="/api/languages", tags=["languages"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(content.router, prefix="/api/content", tags=["content"])
app.include_router(amplification.router, prefix="/api/amplification", tags=["amplification"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
