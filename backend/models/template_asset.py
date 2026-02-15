from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
from backend.database import Base


class TemplateAsset(Base):
    __tablename__ = "template_assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), ForeignKey("content_templates.id"), nullable=False, index=True)
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    asset_type = Column(String(50), nullable=False)  # background_image, header_image, footer_image, logo_placeholder, layout_pdf, custom_image
    name = Column(String(200), nullable=False)
    file_url = Column(String(500), default="")
    file_name = Column(String(200), default="")
    file_size = Column(Integer, default=0)
    mime_type = Column(String(100), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<TemplateAsset [{self.asset_type}] {self.name}>"
