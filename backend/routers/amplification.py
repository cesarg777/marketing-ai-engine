from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.content import ContentItem
from backend.models.metrics import ContentMetric
from backend.schemas.content import ContentItemResponse

router = APIRouter()


@router.get("/candidates")
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


@router.post("/blog", response_model=ContentItemResponse)
def amplify_to_blog(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Expand a content item into a full blog post."""
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
def create_newsletter(
    content_ids: list[str],
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a newsletter from selected content items."""
    items = (
        db.query(ContentItem)
        .filter(ContentItem.id.in_(content_ids), ContentItem.org_id == org_id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="No content found")

    from backend.services.amplification_service import compose_newsletter
    result = compose_newsletter(db=db, items=items)
    return result


@router.post("/newsletter/send")
def send_newsletter(
    newsletter_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Send a composed newsletter via Resend."""
    from backend.services.amplification_service import send_newsletter_email
    result = send_newsletter_email(db=db, newsletter_id=newsletter_id)
    return result


@router.post("/landing-page")
def create_landing_page(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a Webflow landing page from content."""
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
