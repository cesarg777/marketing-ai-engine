from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, JSON, DateTime, func
from sqlalchemy.orm import relationship
from backend.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    logo_url = Column(String(500), default="")
    brand_voice = Column(JSON, default=lambda: {})
    settings = Column(JSON, default=lambda: {})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # Cascade deletes for org-scoped models
    users = relationship("UserProfile", cascade="all, delete-orphan", passive_deletes=True)
    org_configs = relationship("OrgConfig", cascade="all, delete-orphan", passive_deletes=True)
    research_configs = relationship("ResearchConfig", cascade="all, delete-orphan", passive_deletes=True)
    research_weeks = relationship("ResearchWeek", cascade="all, delete-orphan", passive_deletes=True)
    org_resources = relationship("OrgResource", cascade="all, delete-orphan", passive_deletes=True)
    platform_metrics = relationship("PlatformMetric", cascade="all, delete-orphan", passive_deletes=True)
    weekly_reports = relationship("WeeklyReport", cascade="all, delete-orphan", passive_deletes=True)
    content_items = relationship("ContentItem", cascade="all, delete-orphan", passive_deletes=True)

    def __repr__(self):
        return f"<Organization {self.slug}>"
