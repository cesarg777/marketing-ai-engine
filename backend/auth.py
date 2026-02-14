from __future__ import annotations

import logging
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config
from backend.database import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

# Dev-mode default org ID (used when no Supabase JWT is configured)
DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"

# Explicitly check for dev mode via environment variable
_IS_DEV_MODE = os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "local")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """Decode Supabase JWT and return the payload.

    Returns the full JWT claims dict including 'sub' (user UUID),
    'email', 'role', etc.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwt_secret = Config.SUPABASE_JWT_SECRET

    # Dev mode bypass: only when JWT secret is missing AND explicitly in dev
    if not jwt_secret:
        if _IS_DEV_MODE:
            logger.warning("Auth bypass: no JWT secret configured (dev mode)")
            return {"sub": "dev-user", "email": "dev@localhost", "role": "authenticated"}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[ALGORITHM],
            audience="authenticated",
            options={
                "require_sub": True,
                "require_exp": True,
                "require_iat": True,
            },
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate that sub is non-empty
    sub = payload.get("sub", "")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    """Extract the user UUID from the JWT payload."""
    user_id = user.get("sub", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity",
        )
    return user_id


def get_current_org_id(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> str:
    """Look up the user's org_id from the user_profiles table.

    In dev mode (no JWT secret), returns the dev org ID.
    """
    user_id = user.get("sub", "")

    if not Config.SUPABASE_JWT_SECRET and _IS_DEV_MODE:
        return DEV_ORG_ID

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity",
        )

    from backend.models.user import UserProfile
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found. Complete onboarding first.",
        )
    return profile.org_id
