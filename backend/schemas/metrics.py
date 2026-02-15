from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import date, datetime


class MetricImportRequest(BaseModel):
    content_item_id: str = Field(..., max_length=36)
    channel: str = Field(..., min_length=1, max_length=50)
    date: date
    impressions: int = Field(default=0, ge=0)
    reach: int = Field(default=0, ge=0)
    engagement: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)
    custom_data: dict = Field(default_factory=dict)


class MetricResponse(BaseModel):
    id: str
    content_item_id: str
    channel: str
    date: date
    impressions: int
    reach: int
    engagement: int
    clicks: int
    conversions: int
    custom_data: dict

    model_config = {"from_attributes": True}


class DashboardResponse(BaseModel):
    total_content: int
    total_published: int
    total_impressions: int
    total_engagement: int
    top_content: list[dict]
    content_by_type: dict
    content_by_language: dict


class WeeklyReportResponse(BaseModel):
    id: str
    week_start: date
    top_content_ids: list[str]
    ai_insights: str
    recommendations: list[dict]
    amplification_candidates: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformMetricResponse(BaseModel):
    id: str
    org_id: str
    platform: str
    date: date
    page_path: str
    sessions: int
    pageviews: int
    users: int
    impressions: int
    clicks: int
    engagement: int
    extra_data: dict

    model_config = {"from_attributes": True}


class SyncSummary(BaseModel):
    platform: str
    synced: int
    summary: dict
