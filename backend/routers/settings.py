from __future__ import annotations

import json
import logging
import os
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_org_id
from backend.security import limiter
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
@limiter.limit("10/minute")
def save_brand_settings(
    request: Request,
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
@limiter.limit("10/minute")
def save_icp_profile(
    request: Request,
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
@limiter.limit("5/minute")
def connect_ga4(
    request: Request,
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
@limiter.limit("5/minute")
def connect_figma(
    request: Request,
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


# ─── Canva Connection (OAuth 2.0 + PKCE) ───

# Thread-safe TTL store for PKCE verifiers (5 min expiry)
_canva_pkce_store: dict[str, tuple[str, float]] = {}
_PKCE_TTL = 300  # 5 minutes

def _pkce_set(key: str, verifier: str) -> None:
    """Store PKCE verifier with TTL."""
    _canva_pkce_store[key] = (verifier, time.time() + _PKCE_TTL)
    # Cleanup expired entries
    now = time.time()
    expired = [k for k, (_, exp) in _canva_pkce_store.items() if exp < now]
    for k in expired:
        _canva_pkce_store.pop(k, None)

def _pkce_pop(key: str) -> str | None:
    """Pop PKCE verifier if not expired."""
    entry = _canva_pkce_store.pop(key, None)
    if entry is None:
        return None
    verifier, expires_at = entry
    if time.time() > expires_at:
        return None
    return verifier


class CanvaAuthUrlResponse(BaseModel):
    auth_url: str
    state: str


class CanvaCallbackRequest(BaseModel):
    code: str = Field(..., min_length=1)
    state: str = Field(..., min_length=1)


class CanvaStatusResponse(BaseModel):
    connected: bool
    user_name: str | None = None


class CanvaTemplateItem(BaseModel):
    id: str
    title: str
    thumbnail: dict = {}


class CanvaFieldItem(BaseModel):
    name: str
    type: str


@router.get("/canva/authorize-url", response_model=CanvaAuthUrlResponse)
def get_canva_authorize_url(
    org_id: str = Depends(get_current_org_id),
):
    """Generate a Canva OAuth authorization URL with PKCE."""
    client_id = os.getenv("CANVA_CLIENT_ID", "")
    redirect_uri = os.getenv("CANVA_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=400, detail="Canva integration not configured. Set CANVA_CLIENT_ID and CANVA_REDIRECT_URI.")

    from backend.services.canva_service import generate_pkce, build_auth_url

    code_verifier, code_challenge = generate_pkce()
    state = secrets.token_urlsafe(32)

    # Store verifier for callback (keyed by org_id:state)
    _pkce_set(f"{org_id}:{state}", code_verifier)

    auth_url = build_auth_url(client_id, redirect_uri, state, code_challenge)
    return CanvaAuthUrlResponse(auth_url=auth_url, state=state)


@router.post("/canva/callback", response_model=CanvaStatusResponse)
@limiter.limit("5/minute")
def canva_oauth_callback(
    request: Request,
    data: CanvaCallbackRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Exchange Canva OAuth code for tokens and store connection."""
    client_id = os.getenv("CANVA_CLIENT_ID", "")
    client_secret = os.getenv("CANVA_CLIENT_SECRET", "")
    redirect_uri = os.getenv("CANVA_REDIRECT_URI", "")

    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Canva integration not configured.")

    # Retrieve PKCE verifier (with TTL check)
    store_key = f"{org_id}:{data.state}"
    code_verifier = _pkce_pop(store_key)
    if not code_verifier:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state. Please try connecting again.")

    from backend.services.canva_service import exchange_code, get_user_info

    try:
        token_data = exchange_code(client_id, client_secret, data.code, redirect_uri, code_verifier)
    except Exception as e:
        logger.warning("Canva OAuth exchange failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Failed to connect Canva: {str(e)[:200]}")

    access_token = token_data["access_token"]

    # Get user display name
    user_name = ""
    try:
        profile = get_user_info(access_token)
        user_name = profile.get("display_name", profile.get("name", ""))
    except Exception:
        pass

    upsert_org_config(db, org_id, CANVA_CONFIG_KEY, {
        "access_token": access_token,
        "refresh_token": token_data.get("refresh_token", ""),
        "expires_at": time.time() + token_data.get("expires_in", 3600),
        "user_name": user_name,
    })

    return CanvaStatusResponse(connected=True, user_name=user_name or None)


@router.get("/canva/status", response_model=CanvaStatusResponse)
def get_canva_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Check Canva connection status."""
    config = get_org_config(db, org_id, CANVA_CONFIG_KEY)
    if not config or not config.get("access_token"):
        return CanvaStatusResponse(connected=False)
    return CanvaStatusResponse(
        connected=True,
        user_name=config.get("user_name"),
    )


@router.delete("/canva/disconnect")
def disconnect_canva(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Disconnect Canva."""
    delete_org_config(db, org_id, CANVA_CONFIG_KEY)
    return {"detail": "Canva disconnected."}


# ─── Canva Browsing ───

@router.get("/canva/brand-templates")
def list_canva_brand_templates(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """List the user's Canva brand templates."""
    config = get_org_config(db, org_id, CANVA_CONFIG_KEY)
    if not config:
        raise HTTPException(status_code=404, detail="Canva not connected. Go to Settings to connect.")

    from backend.services.canva_service import get_valid_token, list_brand_templates

    try:
        access_token, updated = get_valid_token(config)
        if updated:
            upsert_org_config(db, org_id, CANVA_CONFIG_KEY, updated)
        templates = list_brand_templates(access_token)
        return {"templates": templates}
    except Exception as e:
        logger.warning("Canva brand templates failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Failed to list Canva templates: {str(e)[:200]}")


@router.get("/canva/brand-templates/{template_id}/dataset")
def get_canva_template_dataset(
    template_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Get fillable fields for a Canva brand template."""
    config = get_org_config(db, org_id, CANVA_CONFIG_KEY)
    if not config:
        raise HTTPException(status_code=404, detail="Canva not connected. Go to Settings to connect.")

    from backend.services.canva_service import get_valid_token, get_template_dataset

    try:
        access_token, updated = get_valid_token(config)
        if updated:
            upsert_org_config(db, org_id, CANVA_CONFIG_KEY, updated)
        fields = get_template_dataset(access_token, template_id)
        return {"fields": fields}
    except Exception as e:
        logger.warning("Canva template dataset failed for org %s: %s", org_id, e)
        raise HTTPException(status_code=400, detail=f"Failed to get template fields: {str(e)[:200]}")
