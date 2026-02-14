from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.database import Base


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(Integer, primary_key=True)
    problem_id = Column(Integer, ForeignKey("research_problems.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("content_templates.id"), nullable=False)
    title = Column(String(200), nullable=False)
    language = Column(String(10), nullable=False, default="en")
    country = Column(String(5), nullable=True)
    status = Column(String(20), default="draft")        # draft, review, published, amplified
    content_data = Column(JSON, nullable=False)          # Generated content matching template structure
    rendered_html = Column(Text, nullable=True)
    tone = Column(String(50), default="professional")
    generation_model = Column(String(50), default="")
    generation_tokens = Column(Integer, default=0)
    # Self-referential: for translations and amplifications
    parent_id = Column(Integer, ForeignKey("content_items.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    problem = relationship("ResearchProblem", back_populates="content_items")
    template = relationship("ContentTemplate", back_populates="content_items")
    parent = relationship("ContentItem", remote_side=[id], backref="children")
    publications = relationship("Publication", back_populates="content_item", cascade="all, delete-orphan")
    metrics = relationship("ContentMetric", back_populates="content_item", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ContentItem [{self.status}] {self.title[:40]}>"


class Publication(Base):
    __tablename__ = "publications"

    id = Column(Integer, primary_key=True)
    content_item_id = Column(Integer, ForeignKey("content_items.id"), nullable=False)
    channel = Column(String(50), nullable=False)        # linkedin, webflow_blog, webflow_landing, newsletter, linkedin_pulse
    external_id = Column(String(200), default="")
    external_url = Column(String(500), default="")
    published_at = Column(DateTime, server_default=func.now())
    status = Column(String(20), default="published")    # published, draft, failed

    content_item = relationship("ContentItem", back_populates="publications")

    def __repr__(self):
        return f"<Publication [{self.channel}] {self.external_url[:40]}>"
