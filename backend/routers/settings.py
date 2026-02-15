from __future__ import annotations

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_org_id
from backend.services.org_config_service import get_org_config, upsert_org_config, delete_org_config

logger = logging.getLogger(__name__)

router = APIRouter()

ICP_CONFIG_KEY = "icp_profile"
GA4_CONFIG_KEY = "ga4_config"


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


# ─── GA4 Connection ───

class GA4ConnectRequest(BaseModel):
    service_account_json: str = Field(..., min_length=10)
    property_id: str = Field(..., min_length=1, max_length=20)


class GA4StatusResponse(BaseModel):
    connected: bool
    property_id: str | None = None
    client_email: str | None = None


@router.post("/ga4/connect", response_model=GA4StatusResponse)
def connect_ga4(
    data: GA4ConnectRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Connect Google Analytics 4 using a service account JSON key."""
    # Parse and validate the JSON
    try:
        sa_info = json.loads(data.service_account_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON for service account.")

    if "client_email" not in sa_info or "private_key" not in sa_info:
        raise HTTPException(
            status_code=400,
            detail="Service account JSON must contain 'client_email' and 'private_key'.",
        )

    # Test the connection by making a simple GA4 API call
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric
        from google.oauth2.service_account import Credentials

        credentials = Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        client = BetaAnalyticsDataClient(credentials=credentials)
        # Quick test: request sessions for yesterday
        client.run_report(RunReportRequest(
            property=f"properties/{data.property_id}",
            date_ranges=[DateRange(start_date="yesterday", end_date="yesterday")],
            metrics=[Metric(name="sessions")],
        ))
    except Exception as e:
        logger.warning("GA4 connection test failed for org %s: %s", org_id, e)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to GA4: {str(e)[:200]}",
        )

    # Store credentials
    upsert_org_config(db, org_id, GA4_CONFIG_KEY, {
        "service_account_json": data.service_account_json,
        "property_id": data.property_id,
        "client_email": sa_info["client_email"],
    })

    return GA4StatusResponse(
        connected=True,
        property_id=data.property_id,
        client_email=sa_info["client_email"],
    )


@router.get("/ga4/status", response_model=GA4StatusResponse)
def get_ga4_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Check GA4 connection status."""
    config = get_org_config(db, org_id, GA4_CONFIG_KEY)
    if not config:
        return GA4StatusResponse(connected=False)
    return GA4StatusResponse(
        connected=True,
        property_id=config.get("property_id"),
        client_email=config.get("client_email"),
    )


@router.delete("/ga4/disconnect")
def disconnect_ga4(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Disconnect GA4."""
    delete_org_config(db, org_id, GA4_CONFIG_KEY)
    return {"detail": "GA4 disconnected."}
