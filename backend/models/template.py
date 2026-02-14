from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from backend.database import Base


class ContentTemplate(Base):
    __tablename__ = "content_templates"
    __table_args__ = (
        UniqueConstraint("slug", "org_id", name="uq_template_slug_org"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)  # NULL = system template
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    content_type = Column(String(50), nullable=False)
    description = Column(Text, default="")
    structure = Column(JSON, nullable=False)
    visual_layout = Column(Text, default="")
    visual_css = Column(Text, default="")
    system_prompt = Column(Text, default="")
    default_tone = Column(String(50), default="professional")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    content_items = relationship("ContentItem", back_populates="template")

    def __repr__(self):
        return f"<ContentTemplate [{self.content_type}] {self.name}>"
