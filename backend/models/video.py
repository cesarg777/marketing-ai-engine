from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Integer, Text, JSON, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.database import Base


class VideoJob(Base):
    __tablename__ = "video_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_item_id = Column(String(36), ForeignKey("content_items.id"), nullable=False)
    content_item = relationship("ContentItem", back_populates="video_jobs")
    provider = Column(String(30), nullable=False)
    provider_job_id = Column(String(200), default="")
    status = Column(String(20), default="pending")
    script = Column(Text, default="")
    avatar_id = Column(String(200), default="")
    language = Column(String(10), default="en")
    video_url = Column(String(500), default="")
    thumbnail_url = Column(String(500), default="")
    duration_seconds = Column(Integer, default=0)
    error_message = Column(Text, default="")
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<VideoJob [{self.provider}] {self.status}>"
