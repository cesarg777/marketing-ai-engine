from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.content import ContentItem, Publication
from backend.models.template import ContentTemplate
from backend.models.research import ResearchProblem
from backend.schemas.content import (
    ContentGenerateRequest, ContentUpdateRequest, TranslateRequest,
    PublishRequest, ContentItemResponse, PublicationResponse,
)

router = APIRouter()


@router.get("/", response_model=list[ContentItemResponse])
def list_content(
    content_type: str | None = None,
    language: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(ContentItem)
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
def get_content(content_id: int, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    return item


@router.post("/generate", response_model=ContentItemResponse)
def generate_content(data: ContentGenerateRequest, db: Session = Depends(get_db)):
    """Generate content using Claude API based on a problem + template."""
    template = db.query(ContentTemplate).filter(ContentTemplate.id == data.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    problem = None
    topic = data.custom_topic or ""
    if data.problem_id:
        problem = db.query(ResearchProblem).filter(ResearchProblem.id == data.problem_id).first()
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found")
        topic = problem.title

    if not topic:
        raise HTTPException(status_code=400, detail="Provide either problem_id or custom_topic")

    # Call the content generation service
    from backend.services.content_service import generate_content_item
    item = generate_content_item(
        db=db,
        template=template,
        problem=problem,
        topic=topic,
        language=data.language,
        country=data.country,
        tone=data.tone,
        additional_instructions=data.additional_instructions,
    )
    return item


@router.put("/{content_id}", response_model=ContentItemResponse)
def update_content(content_id: int, data: ContentUpdateRequest, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{content_id}")
def delete_content(content_id: int, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(item)
    db.commit()
    return {"detail": "Content deleted"}


@router.post("/{content_id}/translate", response_model=ContentItemResponse)
def translate_content(content_id: int, data: TranslateRequest, db: Session = Depends(get_db)):
    """Translate content to another language, creating a new linked content item."""
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.content_service import translate_content_item
    translated = translate_content_item(
        db=db,
        original=item,
        target_language=data.target_language,
        target_country=data.target_country,
    )
    return translated


@router.post("/{content_id}/publish", response_model=PublicationResponse)
def publish_content(content_id: int, data: PublishRequest, db: Session = Depends(get_db)):
    """Publish content to a channel."""
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    from backend.services.content_service import publish_content_item
    publication = publish_content_item(db=db, item=item, channel=data.channel)
    return publication


@router.get("/{content_id}/versions", response_model=list[ContentItemResponse])
def get_content_versions(content_id: int, db: Session = Depends(get_db)):
    """Get all translations and amplifications of a content item."""
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    # Find root parent
    root_id = item.parent_id or item.id
    children = db.query(ContentItem).filter(ContentItem.parent_id == root_id).all()
    root = db.query(ContentItem).filter(ContentItem.id == root_id).first()
    return [root] + children if root else children
