from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, JSON, DateTime, func
from backend.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    logo_url = Column(String(500), default="")
    brand_voice = Column(JSON, default=dict)
    settings = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Organization {self.slug}>"
