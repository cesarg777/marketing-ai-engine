from sqlalchemy import Column, Integer, String, Text, Date, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.database import Base


class ResearchWeek(Base):
    __tablename__ = "research_weeks"

    id = Column(Integer, primary_key=True)
    week_start = Column(Date, nullable=False, unique=True)
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    problems = relationship("ResearchProblem", back_populates="week", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ResearchWeek {self.week_start} [{self.status}]>"


class ResearchProblem(Base):
    __tablename__ = "research_problems"

    id = Column(Integer, primary_key=True)
    week_id = Column(Integer, ForeignKey("research_weeks.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Integer, default=5)               # 1-10
    trending_direction = Column(String(20), default="stable")  # rising, stable, declining
    primary_niche = Column(String(50), nullable=False)
    related_niches = Column(JSON, default=list)          # ["tech", "marketing"]
    country = Column(String(5), nullable=False)
    language = Column(String(10), default="en")
    source_count = Column(Integer, default=0)
    source_urls = Column(JSON, default=list)
    suggested_angles = Column(JSON, default=list)        # 3 content angles
    keywords = Column(JSON, default=list)                # SEO keywords
    language_variants = Column(JSON, default=dict)       # {"es": "titulo", "pt": "titulo"}
    raw_data = Column(JSON, default=dict)
    created_at = Column(DateTime, server_default=func.now())

    week = relationship("ResearchWeek", back_populates="problems")
    content_items = relationship("ContentItem", back_populates="problem")

    def __repr__(self):
        return f"<ResearchProblem [{self.primary_niche}] {self.title[:40]}>"
