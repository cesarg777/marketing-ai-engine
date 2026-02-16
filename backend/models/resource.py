from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey, func
from backend.database import Base


class OrgResource(Base):
    __tablename__ = "org_resources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)  # logo, brand_manual, font, team_photo, client_logo, color_palette
    name = Column(String(200), nullable=False)
    file_url = Column(String(500), default="")
    file_name = Column(String(200), default="")
    file_size = Column(Integer, default=0)
    mime_type = Column(String(100), default="")
    metadata_json = Column(JSON, default=lambda: {})  # extra info: hex colors, font family, person role, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<OrgResource {self.resource_type}:{self.name}>"
