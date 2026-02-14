from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional


class ResourceCreateRequest(BaseModel):
    resource_type: str = Field(..., pattern=r"^(logo|brand_manual|font|team_photo|client_logo|color_palette)$")
    name: str = Field(..., min_length=1, max_length=200)
    metadata_json: Optional[dict] = None


class ResourceUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    metadata_json: Optional[dict] = None
    is_active: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: str
    org_id: str
    resource_type: str
    name: str
    file_url: str
    file_name: str
    file_size: int
    mime_type: str
    metadata_json: dict
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True
