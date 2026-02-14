from pydantic import BaseModel
from datetime import date, datetime


class MetricImportRequest(BaseModel):
    content_item_id: int
    channel: str
    date: date
    impressions: int = 0
    reach: int = 0
    engagement: int = 0
    clicks: int = 0
    conversions: int = 0
    custom_data: dict = {}


class MetricResponse(BaseModel):
    id: int
    content_item_id: int
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
    id: int
    week_start: date
    top_content_ids: list[int]
    ai_insights: str
    recommendations: list[dict]
    amplification_candidates: list[int]
    created_at: datetime

    model_config = {"from_attributes": True}
