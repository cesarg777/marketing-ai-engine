from __future__ import annotations

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_org_id
from backend.services.org_config_service import get_org_config, upsert_org_config, delete_org_config, mask_secret

logger = logging.getLogger(__name__)

router = APIRouter()

ICP_CONFIG_KEY = "icp_profile"
GA4_CONFIG_KEY = "ga4_config"
FIGMA_CONFIG_KEY = "figma_config"
CANVA_CONFIG_KEY = "canva_config"


# ─── Brand Schemas ───

class BrandSettingsRequest(BaseModel):
    website: str = Field(default="", max_length=200)
    accent_color: str = Field(default="", max_length=20)


class BrandSettingsResponse(BaseModel):
    website: str
    accent_color: str


# ─── ICP Schemas ───

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


# ─── Brand Endpoints ───

@router.get("/brand", response_model=BrandSettingsResponse)
def get_brand_settings(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Get the org's brand settings (website, accent_color) from Organization.brand_voice."""
    from backend.models.organization import Organization
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    bv = org.brand_voice if isinstance(org.brand_voice, dict) else {}
    return BrandSettingsResponse(
        website=bv.get("website", ""),
        accent_color=bv.get("accent_color", ""),
    )


@router.put("/brand", response_model=BrandSettingsResponse)
def save_brand_settings(
    data: BrandSettingsRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Save the org's brand settings (website, accent_color) into Organization.brand_voice."""
    from backend.models.organization import Organization
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    bv = org.brand_voice if isinstance(org.brand_voice, dict) else {}
    bv["website"] = data.website.strip()
    bv["accent_color"] = data.accent_color.strip()
    org.brand_voice = bv
    db.commit()
    db.refresh(org)

    return BrandSettingsResponse(
        website=bv.get("website", ""),
        accent_color=bv.get("accent_color", ""),
    )


# ─── ICP Endpoints ───

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


# ─── Figma Connection ───

class FigmaConnectRequest(BaseModel):
    personal_access_token: str = Field(..., min_length=10, max_length=300)


class FigmaStatusResponse(BaseModel):
    connected: bool
    user_name: str | None = None
    masked_token: str | None = None


@router.post("/figma/connect", response_model=FigmaStatusResponse)
def connect_figma(
    data: FigmaConnectRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Connect Figma using a Personal Access Token."""
    from backend.services.figma_service import validate_token

    try:
        user_info = validate_token(data.personal_access_token)
    except Exception as e:
        logger.warning("Figma connection failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Invalid Figma token: {str(e)[:200]}")

    user_name = user_info.get("handle") or user_info.get("email", "")
    upsert_org_config(db, org_id, FIGMA_CONFIG_KEY, {
        "token": data.personal_access_token,
        "user_name": user_name,
    })

    return FigmaStatusResponse(
        connected=True,
        user_name=user_name,
        masked_token=mask_secret(data.personal_access_token),
    )


@router.get("/figma/status", response_model=FigmaStatusResponse)
def get_figma_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Check Figma connection status."""
    config = get_org_config(db, org_id, FIGMA_CONFIG_KEY)
    if not config:
        return FigmaStatusResponse(connected=False)
    return FigmaStatusResponse(
        connected=True,
        user_name=config.get("user_name"),
        masked_token=mask_secret(config.get("token", "")),
    )


@router.delete("/figma/disconnect")
def disconnect_figma(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Disconnect Figma."""
    delete_org_config(db, org_id, FIGMA_CONFIG_KEY)
    return {"detail": "Figma disconnected."}


# ─── Figma Browsing ───

@router.get("/figma/files/{file_key}")
def browse_figma_file(
    file_key: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Browse a Figma file's pages and frames."""
    from backend.services.figma_service import get_file_info

    config = get_org_config(db, org_id, FIGMA_CONFIG_KEY)
    if not config:
        raise HTTPException(status_code=404, detail="Figma not connected. Go to Settings to connect.")

    try:
        return get_file_info(config["token"], file_key)
    except Exception as e:
        logger.warning("Figma file browse failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Failed to read Figma file: {str(e)[:200]}")


@router.get("/figma/files/{file_key}/frames/{node_id}/text-nodes")
def get_figma_text_nodes(
    file_key: str,
    node_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Get text nodes from a specific Figma frame for field mapping."""
    from backend.services.figma_service import get_frame_text_nodes

    config = get_org_config(db, org_id, FIGMA_CONFIG_KEY)
    if not config:
        raise HTTPException(status_code=404, detail="Figma not connected. Go to Settings to connect.")

    try:
        return get_frame_text_nodes(config["token"], file_key, node_id)
    except Exception as e:
        logger.warning("Figma text nodes failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Failed to get text nodes: {str(e)[:200]}")
