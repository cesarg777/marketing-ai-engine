from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Text, Date, DateTime, JSON, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship
from backend.database import Base


class ResearchWeek(Base):
    __tablename__ = "research_weeks"
    __table_args__ = (
        UniqueConstraint("org_id", "week_start", name="uq_research_week_org_week"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False)
    status = Column(String(20), default="pending", index=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    completed_at = Column(DateTime, nullable=True)

    problems = relationship("ResearchProblem", back_populates="week", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ResearchWeek {self.week_start} [{self.status}]>"


class ResearchProblem(Base):
    __tablename__ = "research_problems"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    week_id = Column(String(36), ForeignKey("research_weeks.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Integer, default=5)
    trending_direction = Column(String(20), default="stable")
    primary_niche = Column(String(50), nullable=False)
    related_niches = Column(JSON, default=lambda: [])
    country = Column(String(5), nullable=False)
    language = Column(String(10), default="en")
    source_count = Column(Integer, default=0)
    source_urls = Column(JSON, default=lambda: [])
    suggested_angles = Column(JSON, default=lambda: [])
    keywords = Column(JSON, default=lambda: [])
    language_variants = Column(JSON, default=lambda: {})
    raw_data = Column(JSON, default=lambda: {})
    created_at = Column(DateTime, server_default=func.now())

    week = relationship("ResearchWeek", back_populates="problems")
    content_items = relationship("ContentItem", back_populates="problem")

    def __repr__(self):
        return f"<ResearchProblem [{self.primary_niche}] {self.title[:40]}>"
