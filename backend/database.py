import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Add project root to path so tools.config is importable
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config

is_sqlite = "sqlite" in Config.DATABASE_URL

# Ensure data directory exists (only needed for SQLite)
if is_sqlite:
    Config.DATA_DIR.mkdir(parents=True, exist_ok=True)

# Engine kwargs differ between SQLite and PostgreSQL
engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(Config.DATABASE_URL, echo=False, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from backend.models import (  # noqa: F401
        Organization, UserProfile, Language,
        ResearchWeek, ResearchProblem, ResearchConfig, ContentTemplate,
        ContentItem, Publication, ContentMetric, WeeklyReport,
        VideoJob, OrgConfig, OrgResource,
    )
    Base.metadata.create_all(bind=engine)
