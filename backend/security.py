"""Security utilities: UUID validation, security headers, rate limiting."""
from __future__ import annotations

import re
import os
from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# --------------- Rate limiter ---------------

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# Strict UUID v4 pattern
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def validate_uuid(value: str, param_name: str = "id") -> str:
    """Validate that a string is a well-formed UUID."""
    if not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid UUID format for {param_name}",
        )
    return value


# --------------- Allowed fields for setattr updates ---------------

TEMPLATE_UPDATE_FIELDS = frozenset({
    "name", "description", "structure", "visual_layout",
    "visual_css", "system_prompt", "default_tone", "is_active",
})

CONTENT_UPDATE_FIELDS = frozenset({
    "title", "content_data", "status", "tone",
})

LANGUAGE_UPDATE_FIELDS = frozenset({
    "name", "native_name", "flag_emoji", "is_active",
})

RESEARCH_CONFIG_UPDATE_FIELDS = frozenset({
    "name", "niches", "countries", "is_active",
})


def safe_update(obj, data_dict: dict, allowed_fields: frozenset) -> None:
    """Apply only allowed fields from data_dict to an ORM object."""
    for key, value in data_dict.items():
        if key not in allowed_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field '{key}' is not updatable",
            )
        setattr(obj, key, value)


# --------------- Security headers middleware ---------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add standard security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # HSTS only in production (when not localhost)
        if not request.url.hostname or request.url.hostname not in ("localhost", "127.0.0.1"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


# --------------- File upload validation ---------------

MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CSV_CONTENT_TYPES = {"text/csv", "application/vnd.ms-excel", "text/plain"}


def validate_csv_upload(content_type: str | None, file_size: int) -> None:
    """Validate CSV upload constraints."""
    if content_type and content_type not in ALLOWED_CSV_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{content_type}'. Expected CSV.",
        )
    if file_size > MAX_CSV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_CSV_SIZE_BYTES // (1024*1024)} MB.",
        )
