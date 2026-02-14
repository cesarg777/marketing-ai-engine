from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime

VALID_CHANNELS = {"linkedin", "webflow_blog", "webflow_landing", "newsletter"}
VALID_STATUSES = {"draft", "review", "published", "amplified", "archived"}


class ContentGenerateRequest(BaseModel):
    problem_id: str | None = Field(default=None, max_length=36)
    custom_topic: str | None = Field(default=None, max_length=500)
    template_id: str = Field(..., max_length=36)
    language: str = Field(default="en", min_length=2, max_length=10)
    country: str | None = Field(default=None, max_length=5)
    tone: str = Field(default="professional", max_length=50)
    additional_instructions: str = Field(default="", max_length=2000)


class ContentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    content_data: dict | None = None
    status: str | None = Field(default=None, max_length=20)
    tone: str | None = Field(default=None, max_length=50)


class TranslateRequest(BaseModel):
    target_language: str = Field(..., min_length=2, max_length=10)
    target_country: str | None = Field(default=None, max_length=5)


class PublishRequest(BaseModel):
    channel: str = Field(..., max_length=30)


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


class RenderResponse(BaseModel):
    file_name: str
    asset_url: str
    format: str
    rendered_html: str


class PublicationResponse(BaseModel):
    id: str
    content_item_id: str
    channel: str
    external_id: str
    external_url: str
    published_at: datetime
    status: str

    model_config = {"from_attributes": True}
