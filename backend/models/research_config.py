from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, UniqueConstraint, func
from backend.database import Base


class ResearchConfig(Base):
    __tablename__ = "research_configs"
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_research_config_name_org"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(200), nullable=False)
    niches = Column(JSON, default=list)
    countries = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<ResearchConfig {self.name}>"
