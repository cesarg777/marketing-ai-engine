"""Org Brand Resources router — upload and manage brand assets."""
from __future__ import annotations

import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_org_id
from backend.security import validate_uuid, limiter
from backend.models.resource import OrgResource
from backend.schemas.resource import ResourceResponse, ResourceUpdateRequest
from backend.services.storage_service import upload_file, delete_file, BUCKET_UPLOADS

router = APIRouter()

# Upload limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {
    "logo": {"image/png", "image/jpeg", "image/svg+xml", "image/webp"},
    "brand_manual": {"application/pdf"},
    "font": {"font/woff2", "font/woff", "font/ttf", "application/font-woff2", "application/font-woff", "application/x-font-ttf", "application/octet-stream"},
    "team_photo": {"image/png", "image/jpeg", "image/webp"},
    "client_logo": {"image/png", "image/jpeg", "image/svg+xml", "image/webp"},
    "color_palette": set(),  # No file — just metadata_json with hex codes
}

VALID_RESOURCE_TYPES = set(ALLOWED_TYPES.keys())


def _serialize(r: OrgResource) -> dict:
    return {
        "id": r.id,
        "org_id": r.org_id,
        "resource_type": r.resource_type,
        "name": r.name,
        "file_url": r.file_url,
        "file_name": r.file_name,
        "file_size": r.file_size,
        "mime_type": r.mime_type,
        "metadata_json": r.metadata_json or {},
        "is_active": r.is_active,
        "created_at": str(r.created_at) if r.created_at else "",
    }


@router.get("/")
def list_resources(
    resource_type: str | None = None,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    q = db.query(OrgResource).filter(OrgResource.org_id == org_id)
    if resource_type:
        if resource_type not in VALID_RESOURCE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid resource_type: {resource_type}")
        q = q.filter(OrgResource.resource_type == resource_type)
    resources = q.order_by(OrgResource.created_at.desc()).all()
    return [_serialize(r) for r in resources]


@router.get("/types")
def list_resource_types(org_id: str = Depends(get_current_org_id)):
    return [
        {"type": "logo", "label": "Logos", "accepts": "PNG, JPG, SVG, WebP", "has_file": True},
        {"type": "brand_manual", "label": "Brand Manual", "accepts": "PDF", "has_file": True},
        {"type": "font", "label": "Fonts", "accepts": "WOFF2, WOFF, TTF", "has_file": True},
        {"type": "team_photo", "label": "Team Photos", "accepts": "PNG, JPG, WebP", "has_file": True},
        {"type": "client_logo", "label": "Client Logos", "accepts": "PNG, JPG, SVG, WebP", "has_file": True},
        {"type": "color_palette", "label": "Color Palette", "accepts": "No file needed", "has_file": False},
    ]


@router.get("/{resource_id}")
def get_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(resource_id, "resource_id")
    resource = db.query(OrgResource).filter(
        OrgResource.id == resource_id,
        OrgResource.org_id == org_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return _serialize(resource)


@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_resource(
    request: Request,
    resource_type: str = Form(...),
    name: str = Form(...),
    metadata_json: str = Form("{}"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Validate resource type
    if resource_type not in VALID_RESOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid resource_type: {resource_type}")

    if resource_type == "color_palette":
        raise HTTPException(status_code=400, detail="Color palette doesn't require file upload. Use POST / instead.")

    # Validate mime type
    allowed = ALLOWED_TYPES.get(resource_type, set())
    if allowed and file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}' for {resource_type}",
        )

    # Read file and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    # Upload file via storage service
    ext = Path(file.filename or "file").suffix
    file_id = str(uuid.uuid4())
    storage_path = f"{org_id}/{resource_type}/{file_id}{ext}"
    file_url = upload_file(
        bucket=BUCKET_UPLOADS,
        path=storage_path,
        data=contents,
        content_type=file.content_type or "application/octet-stream",
    )

    # Parse metadata
    import json
    try:
        meta = json.loads(metadata_json) if metadata_json else {}
    except json.JSONDecodeError:
        meta = {}

    resource = OrgResource(
        org_id=org_id,
        resource_type=resource_type,
        name=name.strip(),
        file_url=file_url,
        file_name=file.filename or "",
        file_size=len(contents),
        mime_type=file.content_type or "",
        metadata_json=meta,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _serialize(resource)


@router.post("/", status_code=201)
def create_resource_no_file(
    resource_type: str = Form("color_palette"),
    name: str = Form(...),
    metadata_json: str = Form("{}"),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a resource without a file (e.g., color palette with hex codes)."""
    if resource_type not in VALID_RESOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid resource_type: {resource_type}")

    import json
    try:
        meta = json.loads(metadata_json) if metadata_json else {}
    except json.JSONDecodeError:
        meta = {}

    resource = OrgResource(
        org_id=org_id,
        resource_type=resource_type,
        name=name.strip(),
        metadata_json=meta,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _serialize(resource)


@router.put("/{resource_id}")
def update_resource(
    resource_id: str,
    name: str | None = Form(None),
    metadata_json: str | None = Form(None),
    is_active: bool | None = Form(None),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(resource_id, "resource_id")
    resource = db.query(OrgResource).filter(
        OrgResource.id == resource_id,
        OrgResource.org_id == org_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if name is not None:
        resource.name = name.strip()
    if is_active is not None:
        resource.is_active = is_active
    if metadata_json is not None:
        import json
        try:
            resource.metadata_json = json.loads(metadata_json)
        except json.JSONDecodeError:
            pass

    db.commit()
    db.refresh(resource)
    return _serialize(resource)


@router.delete("/{resource_id}")
def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(resource_id, "resource_id")
    resource = db.query(OrgResource).filter(
        OrgResource.id == resource_id,
        OrgResource.org_id == org_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Delete file from storage
    if resource.file_url:
        # Extract storage path from URL (works for both local and Supabase URLs)
        if "/api/uploads/" in resource.file_url:
            storage_path = resource.file_url.split("/api/uploads/", 1)[1]
        elif f"/{BUCKET_UPLOADS}/" in resource.file_url:
            storage_path = resource.file_url.split(f"/{BUCKET_UPLOADS}/", 1)[1]
        else:
            storage_path = None
        if storage_path:
            delete_file(BUCKET_UPLOADS, storage_path)

    db.delete(resource)
    db.commit()
    return {"detail": "Resource deleted"}
