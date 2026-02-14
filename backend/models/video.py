from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, func
from backend.database import Base


class VideoJob(Base):
    __tablename__ = "video_jobs"

    id = Column(Integer, primary_key=True)
    content_item_id = Column(Integer, ForeignKey("content_items.id"), nullable=False)
    provider = Column(String(30), nullable=False)        # heygen, synthesia, did
    provider_job_id = Column(String(200), default="")    # External job/video ID
    status = Column(String(20), default="pending")       # pending, processing, completed, failed
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
