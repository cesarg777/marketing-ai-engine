from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, func
from backend.database import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text, default="")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SystemConfig {self.key}>"
