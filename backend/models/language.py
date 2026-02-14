from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from backend.database import Base


class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True)
    code = Column(String(10), unique=True, nullable=False)  # "es", "en", "pt", "fr"
    name = Column(String(50), nullable=False)                # "Spanish", "English"
    native_name = Column(String(50), nullable=False)         # "Español", "English"
    flag_emoji = Column(String(10), default="")              # "🇪🇸", "🇺🇸"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Language {self.code}: {self.name}>"
