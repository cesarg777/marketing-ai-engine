from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime


class ReferenceUrl(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    content_type: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=2000)
    structure: list[dict] = Field(..., max_length=50)
    visual_layout: str = Field(default="", max_length=50000)
    visual_css: str = Field(default="", max_length=50000)
    system_prompt: str = Field(default="", max_length=10000)
    default_tone: str = Field(default="professional", max_length=50)
    reference_urls: list[ReferenceUrl] = Field(default_factory=list, max_length=20)


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    structure: list[dict] | None = Field(default=None, max_length=50)
    visual_layout: str | None = Field(default=None, max_length=50000)
    visual_css: str | None = Field(default=None, max_length=50000)
    system_prompt: str | None = Field(default=None, max_length=10000)
    default_tone: str | None = Field(default=None, max_length=50)
    reference_urls: list[ReferenceUrl] | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class TemplateAssetResponse(BaseModel):
    id: str
    template_id: str
    org_id: str
    asset_type: str
    name: str
    file_url: str
    file_name: str
    file_size: int
    mime_type: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateResponse(BaseModel):
    id: str
    org_id: str | None = None
    name: str
    slug: str
    content_type: str
    description: str
    structure: list[dict]
    visual_layout: str
    visual_css: str
    system_prompt: str
    default_tone: str
    reference_urls: list[dict] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
