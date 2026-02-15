from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime


class ResearchConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    niches: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    decision_makers: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class ResearchConfigUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    niches: list[str] | None = None
    countries: list[str] | None = None
    decision_makers: list[str] | None = None
    keywords: list[str] | None = None
    is_active: bool | None = None


class ResearchConfigResponse(BaseModel):
    id: str
    name: str
    niches: list[str]
    countries: list[str]
    decision_makers: list[str]
    keywords: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
