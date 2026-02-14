from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.template import ContentTemplate
from backend.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from backend.security import validate_uuid, safe_update, TEMPLATE_UPDATE_FIELDS

router = APIRouter()


@router.get("/", response_model=list[TemplateResponse])
def list_templates(
    active_only: bool = False,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Return system templates (org_id=NULL) + org-specific templates
    query = db.query(ContentTemplate).filter(
        or_(ContentTemplate.org_id == None, ContentTemplate.org_id == org_id)
    )
    if active_only:
        query = query.filter(ContentTemplate.is_active == True)
    return query.order_by(ContentTemplate.name).all()


@router.get("/types")
def list_content_types():
    return [
        {"value": "carousel", "label": "Carousel Informativo"},
        {"value": "meet_the_team", "label": "Meet the Team"},
        {"value": "case_study", "label": "Case Study"},
        {"value": "meme", "label": "Meme"},
        {"value": "avatar_video", "label": "Avatar Video"},
        {"value": "linkedin_post", "label": "LinkedIn Post"},
        {"value": "blog_post", "label": "Blog Post"},
        {"value": "newsletter", "label": "Newsletter"},
    ]


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    template = (
        db.query(ContentTemplate)
        .filter(
            ContentTemplate.id == template_id,
            or_(ContentTemplate.org_id == None, ContentTemplate.org_id == org_id),
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/", response_model=TemplateResponse, status_code=201)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    existing = db.query(ContentTemplate).filter(
        ContentTemplate.slug == data.slug,
        ContentTemplate.org_id == org_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Template slug '{data.slug}' already exists for your organization")
    template = ContentTemplate(**data.model_dump(), org_id=org_id)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    template = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.id == template_id, ContentTemplate.org_id == org_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or not editable")
    safe_update(template, data.model_dump(exclude_unset=True), TEMPLATE_UPDATE_FIELDS)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    template = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.id == template_id, ContentTemplate.org_id == org_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_active = False
    db.commit()
    return {"detail": "Template deactivated"}


@router.post("/{template_id}/duplicate", response_model=TemplateResponse)
def duplicate_template(
    template_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    original = (
        db.query(ContentTemplate)
        .filter(
            ContentTemplate.id == template_id,
            or_(ContentTemplate.org_id == None, ContentTemplate.org_id == org_id),
        )
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")

    copy = ContentTemplate(
        name=f"{original.name} (Copy)",
        slug=f"{original.slug}-copy",
        content_type=original.content_type,
        description=original.description,
        structure=original.structure,
        visual_layout=original.visual_layout,
        visual_css=original.visual_css,
        system_prompt=original.system_prompt,
        default_tone=original.default_tone,
        org_id=org_id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy
