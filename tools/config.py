import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Config:
    # Environment
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION = ENVIRONMENT.lower() == "production"

    # Project paths
    PROJECT_ROOT = PROJECT_ROOT
    TMP_DIR = PROJECT_ROOT / ".tmp"
    DATA_DIR = PROJECT_ROOT / "data"

    # Anthropic
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
    ANTHROPIC_MODEL_RESEARCH = os.getenv("ANTHROPIC_MODEL_RESEARCH", "claude-opus-4-6")

    # Research sources
    SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
    APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")

    # Webflow
    WEBFLOW_API_TOKEN = os.getenv("WEBFLOW_API_TOKEN", "")
    WEBFLOW_SITE_ID = os.getenv("WEBFLOW_SITE_ID", "")
    WEBFLOW_BLOG_COLLECTION_ID = os.getenv("WEBFLOW_BLOG_COLLECTION_ID", "")
    WEBFLOW_LANDING_COLLECTION_ID = os.getenv("WEBFLOW_LANDING_COLLECTION_ID", "")

    # Newsletter
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    NEWSLETTER_FROM_EMAIL = os.getenv("NEWSLETTER_FROM_EMAIL", "newsletter@siete.com")

    # AI Video providers
    HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY", "")
    HEYGEN_AVATAR_ID = os.getenv("HEYGEN_AVATAR_ID", "")
    SYNTHESIA_API_KEY = os.getenv("SYNTHESIA_API_KEY", "")
    DID_API_KEY = os.getenv("DID_API_KEY", "")

    # Google Analytics
    GA_PROPERTY_ID = os.getenv("GOOGLE_ANALYTICS_PROPERTY_ID", "")

    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

    # Database
    _raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/marketing_engine.db")
    # Railway/Heroku provide postgres:// but SQLAlchemy requires postgresql://
    DATABASE_URL = _raw_db_url.replace("postgres://", "postgresql://", 1) if _raw_db_url.startswith("postgres://") else _raw_db_url

    # Frontend URL (for CORS in production)
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Default niches
    DEFAULT_NICHES = [
        "marketing", "tech", "hr", "consulting",
        "finance", "healthcare", "legal", "saas"
    ]

    # Default countries
    DEFAULT_COUNTRIES = ["US", "MX", "CO", "BR", "ES", "AR", "CL", "PE"]
