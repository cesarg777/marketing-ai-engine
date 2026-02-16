from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Integer, Text, Date, JSON, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from backend.database import Base


class PlatformMetric(Base):
    """Site-level metrics from external platforms (GA4, LinkedIn, etc.)"""
    __tablename__ = "platform_metrics"
    __table_args__ = (
        UniqueConstraint("org_id", "platform", "date", "page_path", name="uq_platform_metric"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    platform = Column(String(50), nullable=False)  # "ga4", "linkedin"
    date = Column(Date, nullable=False)
    page_path = Column(String(500), default="/")  # "/" for aggregate, "/blog/..." for page-level
    sessions = Column(Integer, default=0)
    pageviews = Column(Integer, default=0)
    users = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    engagement = Column(Integer, default=0)
    extra_data = Column(JSON, default=lambda: {})  # Platform-specific data
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<PlatformMetric [{self.platform}] {self.date} {self.page_path}>"


class ContentMetric(Base):
    __tablename__ = "content_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_item_id = Column(String(36), ForeignKey("content_items.id"), nullable=False)
    channel = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    engagement = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    custom_data = Column(JSON, default=lambda: {})

    content_item = relationship("ContentItem", back_populates="metrics")

    def __repr__(self):
        return f"<ContentMetric [{self.channel}] {self.date}>"


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    __table_args__ = (
        UniqueConstraint("org_id", "week_start", name="uq_weekly_report_org_week"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False)
    top_content_ids = Column(JSON, default=lambda: [])
    ai_insights = Column(Text, default="")
    recommendations = Column(JSON, default=lambda: [])
    amplification_candidates = Column(JSON, default=lambda: [])
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<WeeklyReport {self.week_start}>"
