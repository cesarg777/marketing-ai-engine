import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Add project root to path so tools.config is importable
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config

# Ensure data directory exists
Config.DATA_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    Config.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in Config.DATABASE_URL else {},
    echo=False,
)
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
        Language, ResearchWeek, ResearchProblem, ContentTemplate,
        ContentItem, Publication, ContentMetric, WeeklyReport,
        VideoJob, SystemConfig,
    )
    Base.metadata.create_all(bind=engine)
