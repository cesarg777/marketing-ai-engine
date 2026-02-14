from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str
    slug: str
    content_type: str
    description: str = ""
    structure: list[dict]
    visual_layout: str = ""
    visual_css: str = ""
    system_prompt: str = ""
    default_tone: str = "professional"


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    structure: list[dict] | None = None
    visual_layout: str | None = None
    visual_css: str | None = None
    system_prompt: str | None = None
    default_tone: str | None = None
    is_active: bool | None = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    slug: str
    content_type: str
    description: str
    structure: list[dict]
    visual_layout: str
    visual_css: str
    system_prompt: str
    default_tone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
