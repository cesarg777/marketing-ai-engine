from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_org_id
from backend.services.org_config_service import get_org_config, upsert_org_config

router = APIRouter()

ICP_CONFIG_KEY = "icp_profile"


# ─── Schemas ───

class ICPProfileRequest(BaseModel):
    industries: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    decision_makers: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    company_description: str = Field(default="", max_length=1000)
    business_model: str = Field(default="B2B", max_length=50)


class ICPProfileResponse(BaseModel):
    industries: list[str]
    countries: list[str]
    decision_makers: list[str]
    keywords: list[str]
    company_description: str
    business_model: str
    is_configured: bool


# ─── Endpoints ───

@router.get("/icp", response_model=ICPProfileResponse)
def get_icp_profile(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Get the org's ICP profile, or return defaults if not configured."""
    from tools.config import Config

    profile = get_org_config(db, org_id, ICP_CONFIG_KEY)
    if not profile:
        return ICPProfileResponse(
            industries=Config.DEFAULT_NICHES,
            countries=Config.DEFAULT_COUNTRIES,
            decision_makers=[],
            keywords=[],
            company_description="",
            business_model="B2B",
            is_configured=False,
        )
    return ICPProfileResponse(
        industries=profile.get("industries", []),
        countries=profile.get("countries", []),
        decision_makers=profile.get("decision_makers", []),
        keywords=profile.get("keywords", []),
        company_description=profile.get("company_description", ""),
        business_model=profile.get("business_model", "B2B"),
        is_configured=True,
    )


@router.put("/icp", response_model=ICPProfileResponse)
def save_icp_profile(
    data: ICPProfileRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Save or update the org's ICP profile."""
    value = data.model_dump()
    upsert_org_config(db, org_id, ICP_CONFIG_KEY, value)
    return ICPProfileResponse(**value, is_configured=True)
