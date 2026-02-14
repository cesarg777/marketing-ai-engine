from __future__ import annotations
from pydantic import BaseModel
from datetime import date, datetime


class ResearchTriggerRequest(BaseModel):
    niches: list[str] | None = None
    countries: list[str] | None = None
    week_start: date | None = None


class ResearchProblemResponse(BaseModel):
    id: int
    week_id: int
    title: str
    description: str
    severity: int
    trending_direction: str
    primary_niche: str
    related_niches: list[str]
    country: str
    language: str
    source_count: int
    source_urls: list[str]
    suggested_angles: list[str]
    keywords: list[str]
    language_variants: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ResearchWeekResponse(BaseModel):
    id: int
    week_start: date
    status: str
    created_at: datetime
    completed_at: datetime | None
    problem_count: int = 0

    model_config = {"from_attributes": True}
