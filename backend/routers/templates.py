from __future__ import annotations

import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.template import ContentTemplate
from backend.models.template_asset import TemplateAsset
from backend.schemas.template import (
    TemplateCreate, TemplateUpdate, TemplateResponse, TemplateAssetResponse,
)
from backend.security import validate_uuid, safe_update, TEMPLATE_UPDATE_FIELDS
from backend.services.storage_service import upload_file, delete_file, BUCKET_UPLOADS

router = APIRouter()

# Asset upload limits
MAX_ASSET_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_ASSET_MIMES = {
    "image/png", "image/jpeg", "image/svg+xml", "image/webp", "application/pdf",
}
VALID_ASSET_TYPES = {
    "background_image", "header_image", "footer_image",
    "logo_placeholder", "layout_pdf", "custom_image",
    "reference_file",
}


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
        reference_urls=original.reference_urls or [],
        org_id=org_id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)

    # Copy assets (share file URLs — no need to duplicate files)
    original_assets = db.query(TemplateAsset).filter(
        TemplateAsset.template_id == original.id,
    ).all()
    for asset in original_assets:
        copy_asset = TemplateAsset(
            template_id=copy.id,
            org_id=org_id,
            asset_type=asset.asset_type,
            name=asset.name,
            file_url=asset.file_url,
            file_name=asset.file_name,
            file_size=asset.file_size,
            mime_type=asset.mime_type,
            sort_order=asset.sort_order,
        )
        db.add(copy_asset)
    if original_assets:
        db.commit()

    return copy


# ─── Template Asset Endpoints ───


@router.get("/{template_id}/assets", response_model=list[TemplateAssetResponse])
def list_template_assets(
    template_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    # Verify template access
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

    return (
        db.query(TemplateAsset)
        .filter(TemplateAsset.template_id == template_id)
        .order_by(TemplateAsset.sort_order, TemplateAsset.created_at)
        .all()
    )


@router.post("/{template_id}/assets/upload", response_model=TemplateAssetResponse, status_code=201)
async def upload_template_asset(
    template_id: str,
    asset_type: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")

    # Only allow uploading to org-owned templates
    template = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.id == template_id, ContentTemplate.org_id == org_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or not editable (system templates are read-only)")

    if asset_type not in VALID_ASSET_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid asset_type: {asset_type}. Valid: {', '.join(sorted(VALID_ASSET_TYPES))}")

    if file.content_type and file.content_type not in ALLOWED_ASSET_MIMES:
        raise HTTPException(status_code=400, detail=f"Invalid file type '{file.content_type}'. Allowed: PNG, JPG, SVG, WebP, PDF.")

    contents = await file.read()
    if len(contents) > MAX_ASSET_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_ASSET_SIZE // (1024*1024)} MB.",
        )

    ext = Path(file.filename or "file").suffix
    file_id = str(uuid.uuid4())
    storage_path = f"{org_id}/template_assets/{template_id}/{file_id}{ext}"
    file_url = upload_file(
        bucket=BUCKET_UPLOADS,
        path=storage_path,
        data=contents,
        content_type=file.content_type or "application/octet-stream",
    )

    asset = TemplateAsset(
        template_id=template_id,
        org_id=org_id,
        asset_type=asset_type,
        name=name.strip(),
        file_url=file_url,
        file_name=file.filename or "",
        file_size=len(contents),
        mime_type=file.content_type or "",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{template_id}/assets/{asset_id}")
def delete_template_asset(
    template_id: str,
    asset_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(template_id, "template_id")
    validate_uuid(asset_id, "asset_id")

    asset = (
        db.query(TemplateAsset)
        .filter(
            TemplateAsset.id == asset_id,
            TemplateAsset.template_id == template_id,
            TemplateAsset.org_id == org_id,
        )
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete from storage
    if asset.file_url:
        try:
            # Extract storage path from URL
            path = f"{org_id}/template_assets/{template_id}/{asset.id}{Path(asset.file_name).suffix}"
            delete_file(BUCKET_UPLOADS, path)
        except Exception:
            pass  # File may already be deleted

    db.delete(asset)
    db.commit()
    return {"detail": "Asset deleted"}
