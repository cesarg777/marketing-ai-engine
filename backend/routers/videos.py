from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.video import VideoJob

router = APIRouter()


class VideoCreateRequest(BaseModel):
    content_item_id: int
    provider: str = "heygen"       # heygen, synthesia, did
    avatar_id: str = ""
    language: str = "en"


class VideoResponse(BaseModel):
    id: int
    content_item_id: int
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
):
    query = db.query(VideoJob)
    if status:
        query = query.filter(VideoJob.status == status)
    return query.order_by(VideoJob.created_at.desc()).limit(limit).all()


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == video_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found")
    return job


@router.post("/generate", response_model=VideoResponse)
def generate_video(data: VideoCreateRequest, db: Session = Depends(get_db)):
    """Generate an avatar video from a content item's script."""
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
def check_video_status(video_id: int, db: Session = Depends(get_db)):
    """Check and update the status of a video generation job."""
    from backend.services.video_service import refresh_video_status
    job = refresh_video_status(db=db, video_id=video_id)
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found")
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
