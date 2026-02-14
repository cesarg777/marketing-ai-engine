from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func
from backend.database import Base


class Language(Base):
    __tablename__ = "languages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(50), nullable=False)
    native_name = Column(String(50), nullable=False)
    flag_emoji = Column(String(10), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Language {self.code}: {self.name}>"
