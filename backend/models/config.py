from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Text, JSON, DateTime, ForeignKey, UniqueConstraint, func
from backend.database import Base


class OrgConfig(Base):
    __tablename__ = "org_config"
    __table_args__ = (
        UniqueConstraint("org_id", "key", name="uq_org_config_org_key"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text, default="")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<OrgConfig {self.key}>"
