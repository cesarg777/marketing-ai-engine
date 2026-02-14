from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class ContentGenerateRequest(BaseModel):
    problem_id: str | None = None
    custom_topic: str | None = None
    template_id: str
    language: str = "en"
    country: str | None = None
    tone: str = "professional"
    additional_instructions: str = ""


class ContentUpdateRequest(BaseModel):
    title: str | None = None
    content_data: dict | None = None
    status: str | None = None
    tone: str | None = None


class TranslateRequest(BaseModel):
    target_language: str
    target_country: str | None = None


class PublishRequest(BaseModel):
    channel: str  # linkedin, webflow_blog, webflow_landing, newsletter


class ContentItemResponse(BaseModel):
    id: str
    problem_id: str | None
    template_id: str
    title: str
    language: str
    country: str | None
    status: str
    content_data: dict
    rendered_html: str | None
    tone: str
    generation_model: str
    generation_tokens: int
    parent_id: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class PublicationResponse(BaseModel):
    id: str
    content_item_id: str
    channel: str
    external_id: str
    external_url: str
    published_at: datetime
    status: str

    model_config = {"from_attributes": True}
