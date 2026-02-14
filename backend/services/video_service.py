from __future__ import annotations
import logging
from sqlalchemy.orm import Session
from backend.models.video import VideoJob
from backend.models.content import ContentItem

logger = logging.getLogger(__name__)


def create_video_job(
    db: Session,
    content_item_id: str,
    provider: str,
    avatar_id: str,
    language: str,
) -> VideoJob:
    """Create a video generation job using the specified provider."""
    item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
    if not item:
        raise ValueError(f"Content item {content_item_id} not found")

    # Extract script from content data
    script = _extract_script(item.content_data)

    job = VideoJob(
        content_item_id=content_item_id,
        provider=provider,
        script=script,
        avatar_id=avatar_id,
        language=language,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch to the right provider
    try:
        from tools.content.video_engine import get_provider
        video_provider = get_provider(provider)
        result = video_provider.create_video(
            script=script,
            avatar_id=avatar_id,
            language=language,
        )
        job.provider_job_id = result.get("job_id", "")
        job.status = "processing"
    except Exception:
        logger.exception("Video creation failed for job %s", job.id)
        job.status = "failed"
        job.error_message = "Video generation failed. Please try again."

    db.commit()
    db.refresh(job)
    return job


def refresh_video_status(db: Session, video_id: str) -> VideoJob | None:
    """Check the provider for updated status on a video job."""
    job = db.query(VideoJob).filter(VideoJob.id == video_id).first()
    if not job or job.status in ("completed", "failed"):
        return job

    try:
        from tools.content.video_engine import get_provider
        video_provider = get_provider(job.provider)
        result = video_provider.check_status(job.provider_job_id)

        if result.get("status") == "completed":
            job.status = "completed"
            job.video_url = result.get("video_url", "")
            job.thumbnail_url = result.get("thumbnail_url", "")
            job.duration_seconds = result.get("duration", 0)
        elif result.get("status") == "failed":
            job.status = "failed"
            job.error_message = result.get("error", "Unknown error")
    except Exception:
        logger.exception("Video status check failed for job %s", job.id)
        job.error_message = "Status check failed. Please try again."

    db.commit()
    db.refresh(job)
    return job


def _extract_script(content_data: dict) -> str:
    """Extract video script text from content data."""
    if "script_sections" in content_data:
        sections = content_data["script_sections"]
        return "\n\n".join(s.get("text", "") for s in sections)
    if "script" in content_data:
        return content_data["script"]
    # Fallback: combine all text fields
    parts = []
    for key, value in content_data.items():
        if key.startswith("_"):
            continue
        if isinstance(value, str):
            parts.append(value)
    return "\n\n".join(parts)
