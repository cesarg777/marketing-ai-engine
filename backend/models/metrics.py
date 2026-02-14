from sqlalchemy import Column, Integer, String, Text, Date, JSON, DateTime, ForeignKey, func
from backend.database import Base
from sqlalchemy.orm import relationship


class ContentMetric(Base):
    __tablename__ = "content_metrics"

    id = Column(Integer, primary_key=True)
    content_item_id = Column(Integer, ForeignKey("content_items.id"), nullable=False)
    channel = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    engagement = Column(Integer, default=0)     # likes + comments + shares
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    custom_data = Column(JSON, default=dict)    # Channel-specific extra metrics

    content_item = relationship("ContentItem", back_populates="metrics")

    def __repr__(self):
        return f"<ContentMetric [{self.channel}] {self.date}>"


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True)
    week_start = Column(Date, nullable=False, unique=True)
    top_content_ids = Column(JSON, default=list)
    ai_insights = Column(Text, default="")
    recommendations = Column(JSON, default=list)
    amplification_candidates = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<WeeklyReport {self.week_start}>"
