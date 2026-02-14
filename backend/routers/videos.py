from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.video import VideoJob
from backend.models.content import ContentItem
from backend.security import validate_uuid, limiter

router = APIRouter()

VALID_VIDEO_PROVIDERS = {"heygen", "synthesia", "did"}


class VideoCreateRequest(BaseModel):
    content_item_id: str = Field(..., max_length=36)
    provider: str = Field(default="heygen", max_length=20)
    avatar_id: str = Field(default="", max_length=100)
    language: str = Field(default="en", min_length=2, max_length=10)


class VideoResponse(BaseModel):
    id: str
    content_item_id: str
    provider: str
    status: str
    video_url: str
    thumbnail_url: str
    duration_seconds: int
    error_message: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[VideoResponse])
def list_videos(
    status: str | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    query = (
        db.query(VideoJob)
        .join(ContentItem, VideoJob.content_item_id == ContentItem.id)
        .filter(ContentItem.org_id == org_id)
    )
    if status:
        query = query.filter(VideoJob.status == status)
    return query.order_by(VideoJob.created_at.desc()).limit(limit).all()


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(video_id, "video_id")
    job = (
        db.query(VideoJob)
        .join(ContentItem, VideoJob.content_item_id == ContentItem.id)
        .filter(VideoJob.id == video_id, ContentItem.org_id == org_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found")
    return job


@router.post("/generate", response_model=VideoResponse)
@limiter.limit("5/minute")
def generate_video(
    request: Request,
    data: VideoCreateRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Generate an avatar video from a content item's script."""
    if data.provider not in VALID_VIDEO_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {', '.join(VALID_VIDEO_PROVIDERS)}")
    # Verify content ownership
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == data.content_item_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    from backend.services.video_service import create_video_job
    job = create_video_job(
        db=db,
        content_item_id=data.content_item_id,
        provider=data.provider,
        avatar_id=data.avatar_id,
        language=data.language,
    )
    return job


@router.get("/{video_id}/status", response_model=VideoResponse)
def check_video_status(
    video_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Check and update the status of a video generation job."""
    validate_uuid(video_id, "video_id")
    # Verify ownership
    job = (
        db.query(VideoJob)
        .join(ContentItem, VideoJob.content_item_id == ContentItem.id)
        .filter(VideoJob.id == video_id, ContentItem.org_id == org_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found")

    from backend.services.video_service import refresh_video_status
    job = refresh_video_status(db=db, video_id=video_id)
    return job


@router.get("/providers/{provider_name}/avatars")
def list_avatars(provider_name: str):
    """List available avatars for a video provider."""
    from tools.content.video_engine import get_provider
    try:
        provider = get_provider(provider_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_name}")
    return provider.list_avatars()
