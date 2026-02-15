from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.content import ContentItem, Publication
from backend.models.template import ContentTemplate
from backend.models.research import ResearchProblem, ResearchWeek
from backend.schemas.content import (
    ContentGenerateRequest, ContentUpdateRequest, TranslateRequest,
    PublishRequest, ContentItemResponse, PublicationResponse, RenderResponse,
)
from backend.security import validate_uuid, safe_update, CONTENT_UPDATE_FIELDS, limiter

router = APIRouter()


@router.get("/", response_model=list[ContentItemResponse])
def list_content(
    content_type: str | None = None,
    language: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    query = db.query(ContentItem).filter(ContentItem.org_id == org_id)
    if language:
        query = query.filter(ContentItem.language == language)
    if status:
        query = query.filter(ContentItem.status == status)
    if content_type:
        query = query.join(ContentTemplate).filter(ContentTemplate.content_type == content_type)
    return (
        query.order_by(ContentItem.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{content_id}", response_model=ContentItemResponse)
def get_content(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    return item


@router.post("/generate", response_model=ContentItemResponse)
@limiter.limit("10/minute")
def generate_content(
    request: Request,
    data: ContentGenerateRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Generate content using Claude API based on a problem + template."""
    # Template: allow system (org_id=NULL) or org-owned
    template = (
        db.query(ContentTemplate)
        .filter(
            ContentTemplate.id == data.template_id,
            or_(ContentTemplate.org_id == None, ContentTemplate.org_id == org_id),
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    problem = None
    topic = data.custom_topic or ""
    if data.problem_id:
        # Problem must belong to a week owned by the same org
        problem = (
            db.query(ResearchProblem)
            .join(ResearchWeek)
            .filter(
                ResearchProblem.id == data.problem_id,
                ResearchWeek.org_id == org_id,
            )
            .first()
        )
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found")
        topic = problem.title

    if not topic:
        raise HTTPException(status_code=400, detail="Provide either problem_id or custom_topic")

    from backend.services.content_service import generate_content_item
    try:
        item = generate_content_item(
            db=db,
            template=template,
            problem=problem,
            topic=topic,
            language=data.language,
            country=data.country,
            tone=data.tone,
            additional_instructions=data.additional_instructions,
            org_id=org_id,
        )
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e))
    return item


@router.put("/{content_id}", response_model=ContentItemResponse)
def update_content(
    content_id: str,
    data: ContentUpdateRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    safe_update(item, data.model_dump(exclude_unset=True), CONTENT_UPDATE_FIELDS)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{content_id}")
def delete_content(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(item)
    db.commit()
    return {"detail": "Content deleted"}


@router.post("/{content_id}/translate", response_model=ContentItemResponse)
def translate_content(
    content_id: str,
    data: TranslateRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Translate content to another language, creating a new linked content item."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.content_service import translate_content_item
    translated = translate_content_item(
        db=db,
        original=item,
        target_language=data.target_language,
        target_country=data.target_country,
        org_id=org_id,
    )
    return translated


@router.post("/{content_id}/publish", response_model=PublicationResponse)
def publish_content(
    content_id: str,
    data: PublishRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Publish content to a channel."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.content_service import publish_content_item
    publication = publish_content_item(db=db, item=item, channel=data.channel)
    return publication


@router.post("/{content_id}/render", response_model=RenderResponse)
def render_content(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Render content item as a visual asset (PNG/PDF)."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    template = (
        db.query(ContentTemplate)
        .filter(
            ContentTemplate.id == item.template_id,
            or_(ContentTemplate.org_id == None, ContentTemplate.org_id == org_id),
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from tools.content.render_asset import VISUAL_TYPES
    if template.content_type not in VISUAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Template type '{template.content_type}' does not support visual rendering",
        )

    from backend.services.render_service import render_content_item
    result = render_content_item(db=db, item=item, template=template)

    return RenderResponse(
        file_name=result["file_name"],
        asset_url=result["asset_url"],
        format=result["format"],
        rendered_html=result["rendered_html"],
    )


@router.get("/{content_id}/versions", response_model=list[ContentItemResponse])
def get_content_versions(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Get all translations and amplifications of a content item."""
    validate_uuid(content_id, "content_id")
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    root_id = item.parent_id or item.id
    children = (
        db.query(ContentItem)
        .filter(ContentItem.parent_id == root_id, ContentItem.org_id == org_id)
        .all()
    )
    root = db.query(ContentItem).filter(ContentItem.id == root_id).first()
    return [root] + children if root else children
