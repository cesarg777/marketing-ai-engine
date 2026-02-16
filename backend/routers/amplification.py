from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import httpx
from backend.database import get_db
from backend.security import limiter, validate_uuid
from backend.auth import get_current_org_id
from backend.models.content import ContentItem, Publication
from backend.models.metrics import ContentMetric
from backend.schemas.content import ContentItemResponse, PublicationResponse

router = APIRouter()


# ─── Pydantic models for channel connections ───

class WebflowConnectRequest(BaseModel):
    api_token: str = Field(..., min_length=5)
    site_id: str = Field(..., min_length=1)
    blog_collection_id: str = Field(default="")
    landing_collection_id: str = Field(default="")


class NewsletterConnectRequest(BaseModel):
    api_key: str = Field(..., min_length=5)
    from_email: str = Field(default="noreply@example.com")


class LinkedInConnectRequest(BaseModel):
    access_token: str = Field(..., min_length=10)


class NewsletterCreateRequest(BaseModel):
    content_ids: list[str] = Field(..., min_length=1)


class BatchPublishRequest(BaseModel):
    content_ids: list[str]
    channel: str = Field(..., max_length=30)


# ─── Response models ───

class AmplifyContentItemResponse(BaseModel):
    content: ContentItemResponse
    publications: list[PublicationResponse] = []

class AmplifyContentListResponse(BaseModel):
    items: list[AmplifyContentItemResponse]
    total: int

class CandidateResponse(BaseModel):
    content: ContentItemResponse
    total_engagement: int = 0
    total_impressions: int = 0

class ChannelResponse(BaseModel):
    name: str
    label: str
    connected: bool
    profile_name: str = ""

class BatchPublishResponse(BaseModel):
    published: list[PublicationResponse]
    errors: list[dict] = []

class ConnectionStatusResponse(BaseModel):
    status: str
    site_name: str = ""
    profile_name: str = ""
    avatar_count: int = 0

class ConnectionCheckResponse(BaseModel):
    connected: bool
    site_name: str = ""
    from_email: str = ""
    profile_name: str = ""
    masked_token: str = ""
    masked_key: str = ""


# ─── Helpers (delegated to shared service) ───

from backend.services.org_config_service import (
    get_org_config as _get_org_config,
    upsert_org_config as _upsert_org_config,
    delete_org_config as _delete_org_config,
    mask_secret as _mask,
)


# ─── Content list for Amplify page ───

@router.get("/content", response_model=AmplifyContentListResponse)
def list_amplify_content(
    status: str | None = None,
    language: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """List all org content with publications for the Amplify page."""
    base_query = db.query(ContentItem).filter(ContentItem.org_id == org_id)
    if status:
        base_query = base_query.filter(ContentItem.status == status)
    if language:
        base_query = base_query.filter(ContentItem.language == language)

    total = base_query.count()
    items = (
        base_query.options(joinedload(ContentItem.publications))
        .order_by(ContentItem.created_at.desc())
        .offset(offset)
        .limit(limit)
        .unique()
        .all()
    )
    return {
        "items": [
            {
                "content": ContentItemResponse.model_validate(item),
                "publications": [
                    PublicationResponse.model_validate(pub) for pub in item.publications
                ],
            }
            for item in items
        ],
        "total": total,
    }


# ─── Candidates (high-engagement) ───

@router.get("/candidates", response_model=list[CandidateResponse])
def list_amplification_candidates(
    limit: int = 10,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """List top-performing content that should be amplified."""
    results = (
        db.query(
            ContentItem,
            func.sum(ContentMetric.engagement).label("total_engagement"),
            func.sum(ContentMetric.impressions).label("total_impressions"),
        )
        .join(ContentMetric, ContentMetric.content_item_id == ContentItem.id)
        .filter(ContentItem.org_id == org_id, ContentItem.status != "amplified")
        .group_by(ContentItem.id)
        .order_by(func.sum(ContentMetric.engagement).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "content": ContentItemResponse.model_validate(item),
            "total_engagement": eng or 0,
            "total_impressions": imp or 0,
        }
        for item, eng, imp in results
    ]


# ─── Amplification actions ───

@router.post("/blog", response_model=ContentItemResponse)
@limiter.limit("10/minute")
def amplify_to_blog(
    request: Request,
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Expand a content item into a full blog post."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.amplification_service import create_blog_from_content
    blog = create_blog_from_content(db=db, source=item, org_id=org_id)
    return blog


@router.post("/newsletter")
@limiter.limit("10/minute")
def create_newsletter(
    request: Request,
    data: NewsletterCreateRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a newsletter from selected content items."""
    items = (
        db.query(ContentItem)
        .filter(ContentItem.id.in_(data.content_ids), ContentItem.org_id == org_id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="No content found")

    from backend.services.amplification_service import compose_newsletter
    result = compose_newsletter(db=db, items=items)
    return result


@router.post("/newsletter/send")
@limiter.limit("5/minute")
def send_newsletter(
    request: Request,
    subject: str,
    html: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Send a composed newsletter via Resend using org's stored API key."""
    config = _get_org_config(db, org_id, "resend_config")
    if not config:
        raise HTTPException(status_code=400, detail="Newsletter not configured. Connect Resend in Settings.")

    from backend.services.amplification_service import send_newsletter_email
    result = send_newsletter_email(
        api_key=config["api_key"],
        from_email=config.get("from_email", "noreply@example.com"),
        subject=subject,
        html=html,
    )
    return result


@router.post("/landing-page")
@limiter.limit("10/minute")
def create_landing_page(
    request: Request,
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a Webflow landing page from content."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.amplification_service import create_webflow_landing
    result = create_webflow_landing(db=db, source=item)
    return result


# ─── Batch Publish ───

@router.post("/batch-publish", response_model=BatchPublishResponse)
@limiter.limit("10/minute")
def batch_publish(
    request: Request,
    data: BatchPublishRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Publish multiple content items to a channel."""
    from backend.services.content_service import publish_content_item

    items = (
        db.query(ContentItem)
        .filter(ContentItem.id.in_(data.content_ids), ContentItem.org_id == org_id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="No content found")

    # For linkedin, verify connection
    if data.channel == "linkedin":
        config = _get_org_config(db, org_id, "linkedin_config")
        if not config:
            raise HTTPException(status_code=400, detail="LinkedIn not connected. Connect in Settings.")

    results = []
    errors = []
    for item in items:
        try:
            pub = publish_content_item(db=db, item=item, channel=data.channel)
            results.append(PublicationResponse.model_validate(pub))
        except Exception as e:
            errors.append({"content_id": item.id, "error": str(e)})

    return {"published": results, "errors": errors}


# ─── Channels list ───

@router.get("/channels", response_model=list[ChannelResponse])
def list_channels(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """List all publishing channels with connection status."""
    linkedin = _get_org_config(db, org_id, "linkedin_config")
    webflow = _get_org_config(db, org_id, "webflow_config")
    resend = _get_org_config(db, org_id, "resend_config")

    return [
        {
            "name": "linkedin",
            "label": "LinkedIn",
            "connected": linkedin is not None,
            "profile_name": linkedin.get("profile_name", "") if linkedin else "",
        },
        {
            "name": "webflow_blog",
            "label": "Webflow Blog",
            "connected": webflow is not None,
        },
        {
            "name": "webflow_landing",
            "label": "Webflow Landing",
            "connected": webflow is not None,
        },
        {
            "name": "newsletter",
            "label": "Newsletter (Resend)",
            "connected": resend is not None,
        },
    ]


# ─── Webflow Connection ───

@router.post("/webflow/connect", response_model=ConnectionStatusResponse)
@limiter.limit("5/minute")
def connect_webflow(
    request: Request,
    data: WebflowConnectRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Save and verify Webflow API credentials."""
    try:
        resp = httpx.get(
            f"https://api.webflow.com/v2/sites/{data.site_id}",
            headers={"Authorization": f"Bearer {data.api_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        site_name = resp.json().get("displayName", resp.json().get("name", ""))
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail="Invalid Webflow credentials. Check your API token and site ID.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not connect to Webflow.")

    _upsert_org_config(db, org_id, "webflow_config", {
        "api_token": data.api_token,
        "site_id": data.site_id,
        "blog_collection_id": data.blog_collection_id,
        "landing_collection_id": data.landing_collection_id,
        "site_name": site_name,
    })
    return {"status": "connected", "site_name": site_name}


@router.get("/webflow/status", response_model=ConnectionCheckResponse)
def webflow_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    config = _get_org_config(db, org_id, "webflow_config")
    if not config:
        return {"connected": False}
    return {
        "connected": True,
        "site_name": config.get("site_name", ""),
        "masked_token": _mask(config.get("api_token", "")),
    }


@router.delete("/webflow/disconnect")
def disconnect_webflow(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    _delete_org_config(db, org_id, "webflow_config")
    return {"status": "disconnected"}


# ─── Newsletter (Resend) Connection ───

@router.post("/newsletter/connect", response_model=ConnectionStatusResponse)
@limiter.limit("5/minute")
def connect_newsletter(
    request: Request,
    data: NewsletterConnectRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Save and verify Resend API key."""
    try:
        resp = httpx.get(
            "https://api.resend.com/api-keys",
            headers={"Authorization": f"Bearer {data.api_key}"},
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail="Invalid Resend API key.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not connect to Resend.")

    _upsert_org_config(db, org_id, "resend_config", {
        "api_key": data.api_key,
        "from_email": data.from_email,
    })
    return {"status": "connected"}


@router.get("/newsletter/status", response_model=ConnectionCheckResponse)
def newsletter_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    config = _get_org_config(db, org_id, "resend_config")
    if not config:
        return {"connected": False}
    return {
        "connected": True,
        "from_email": config.get("from_email", ""),
        "masked_key": _mask(config.get("api_key", "")),
    }


@router.delete("/newsletter/disconnect")
def disconnect_newsletter(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    _delete_org_config(db, org_id, "resend_config")
    return {"status": "disconnected"}


# ─── LinkedIn Connection ───

@router.post("/linkedin/connect", response_model=ConnectionStatusResponse)
@limiter.limit("5/minute")
def connect_linkedin(
    request: Request,
    data: LinkedInConnectRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Save and verify LinkedIn access token."""
    try:
        resp = httpx.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {data.access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        profile = resp.json()
        profile_name = profile.get("name", profile.get("given_name", "LinkedIn User"))
        profile_sub = profile.get("sub", "")
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail="Invalid LinkedIn access token.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not connect to LinkedIn.")

    _upsert_org_config(db, org_id, "linkedin_config", {
        "access_token": data.access_token,
        "profile_name": profile_name,
        "profile_sub": profile_sub,
    })
    return {"status": "connected", "profile_name": profile_name}


@router.get("/linkedin/status", response_model=ConnectionCheckResponse)
def linkedin_status(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    config = _get_org_config(db, org_id, "linkedin_config")
    if not config:
        return {"connected": False}
    return {
        "connected": True,
        "profile_name": config.get("profile_name", ""),
        "masked_token": _mask(config.get("access_token", "")),
    }


@router.delete("/linkedin/disconnect")
def disconnect_linkedin(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    _delete_org_config(db, org_id, "linkedin_config")
    return {"status": "disconnected"}
