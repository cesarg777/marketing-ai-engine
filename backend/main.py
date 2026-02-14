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

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from tools.config import Config
from backend.database import create_tables
from backend.auth import get_current_user
from backend.routers import research, templates, content, amplification, metrics, languages, videos, onboarding

app = FastAPI(
    title="Siete Marketing Engine",
    description="AI-powered B2B content marketing engine",
    version="0.1.0",
)

# CORS — allow both local dev and production frontend
cors_origins = ["http://localhost:3000"]
if Config.FRONTEND_URL and Config.FRONTEND_URL not in cors_origins:
    cors_origins.append(Config.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """Verify token and return current user info."""
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
    }
