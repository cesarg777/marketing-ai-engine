from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, DateTime, func
from sqlalchemy.orm import relationship
from backend.database import Base


class ContentTemplate(Base):
    __tablename__ = "content_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    content_type = Column(String(50), nullable=False)   # carousel, case_study, meme, video, linkedin_post, blog, newsletter
    description = Column(Text, default="")
    # JSON schema defining fields: [{"name": "title", "type": "text", "required": true, "max_length": 100}, ...]
    structure = Column(JSON, nullable=False)
    visual_layout = Column(Text, default="")            # GrapesJS HTML
    visual_css = Column(Text, default="")               # GrapesJS CSS
    # Claude system prompt with {{variable}} placeholders
    system_prompt = Column(Text, default="")
    default_tone = Column(String(50), default="professional")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    content_items = relationship("ContentItem", back_populates="template")

    def __repr__(self):
        return f"<ContentTemplate [{self.content_type}] {self.name}>"
