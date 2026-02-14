"""Storage service abstraction — Supabase Storage in prod, local disk in dev."""
from __future__ import annotations

import logging
from pathlib import Path

from tools.config import Config

logger = logging.getLogger(__name__)

# Supabase Storage buckets
BUCKET_UPLOADS = "uploads"
BUCKET_RENDERS = "renders"


def _get_supabase_client():
    """Lazy-init Supabase client using service role key (server-side)."""
    from supabase import create_client
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)


def _use_supabase() -> bool:
    """Use Supabase Storage when service role key is configured and in production."""
    return bool(Config.SUPABASE_SERVICE_ROLE_KEY and Config.IS_PRODUCTION)


def upload_file(
    bucket: str,
    path: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file and return its public URL.

    Args:
        bucket: Storage bucket name (BUCKET_UPLOADS or BUCKET_RENDERS)
        path: File path within the bucket (e.g. "org_id/logo/uuid.png")
        data: File bytes
        content_type: MIME type

    Returns:
        Public URL string (full Supabase URL in prod, relative /api/ path in dev)
    """
    if _use_supabase():
        client = _get_supabase_client()
        client.storage.from_(bucket).upload(
            path,
            data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = client.storage.from_(bucket).get_public_url(path)
        logger.info("Uploaded to Supabase Storage: %s/%s", bucket, path)
        return public_url

    # Local dev fallback
    local_dir = Config.TMP_DIR / bucket
    dest = local_dir / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    logger.info("Saved locally: %s", dest)
    return f"/api/{bucket}/{path}"


def delete_file(bucket: str, path: str) -> None:
    """Delete a file from storage."""
    if _use_supabase():
        client = _get_supabase_client()
        client.storage.from_(bucket).remove([path])
        logger.info("Deleted from Supabase Storage: %s/%s", bucket, path)
        return

    # Local dev fallback
    local_path = Config.TMP_DIR / bucket / path
    if local_path.exists():
        local_path.unlink()
        logger.info("Deleted locally: %s", local_path)


def get_public_url(bucket: str, path: str) -> str:
    """Get the public URL for a file."""
    if _use_supabase():
        client = _get_supabase_client()
        return client.storage.from_(bucket).get_public_url(path)

    return f"/api/{bucket}/{path}"
