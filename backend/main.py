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

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from tools.config import Config
from backend.database import create_tables
from backend.auth import get_current_user
from backend.security import SecurityHeadersMiddleware, limiter
from backend.routers import research, templates, content, amplification, metrics, languages, videos, onboarding, resources

app = FastAPI(
    title="Siete Marketing Engine",
    description="AI-powered B2B content marketing engine",
    version="0.1.0",
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware (added before CORS so headers apply to all responses)
app.add_middleware(SecurityHeadersMiddleware)

# CORS — allow both local dev and production frontend
cors_origins = ["http://localhost:3000"]
frontend_url = (Config.FRONTEND_URL or "").strip().rstrip("/")
if frontend_url and frontend_url not in cors_origins:
    cors_origins.append(frontend_url)

logger_startup = logging.getLogger(__name__)
logger_startup.info("CORS origins: %s", cors_origins)
logger_startup.info("FRONTEND_URL raw: %r", Config.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
app.include_router(resources.router, prefix="/api/resources", tags=["resources"])


# Serve static files locally (in production, files are in Supabase Storage)
if not Config.IS_PRODUCTION:
    renders_dir = Config.TMP_DIR / "renders"
    renders_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/api/renders", StaticFiles(directory=str(renders_dir)), name="renders")

    uploads_dir = Config.TMP_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


logger = logging.getLogger(__name__)


@app.on_event("startup")
def on_startup():
    create_tables()
    # Log seed data status
    from backend.database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    try:
        lang_count = db.execute(text("SELECT COUNT(*) FROM languages")).scalar()
        tmpl_count = db.execute(text("SELECT COUNT(*) FROM content_templates")).scalar()
        logger.info("Seed data: %d languages, %d templates", lang_count, tmpl_count)
        if lang_count == 0:
            logger.warning("No seed data found. Run: python scripts/seed_templates.py")
    finally:
        db.close()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0", "cors_origins": cors_origins, "frontend_url_raw": Config.FRONTEND_URL, "environment": Config.ENVIRONMENT}


@app.get("/api/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """Verify token and return current user info."""
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
    }
