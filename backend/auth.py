from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config
from backend.database import get_db

security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

# Dev-mode default org ID (used when no Supabase JWT is configured)
DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"


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

    # In dev mode without Supabase, allow unauthenticated access
    if not jwt_secret:
        return {"sub": "dev-user", "email": "dev@localhost", "role": "authenticated"}

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[ALGORITHM],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    """Extract the user UUID from the JWT payload."""
    return user.get("sub", "")


def get_current_org_id(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> str:
    """Look up the user's org_id from the user_profiles table.

    In dev mode (no JWT secret), returns the dev org ID.
    """
    user_id = user.get("sub", "")

    if not Config.SUPABASE_JWT_SECRET:
        return DEV_ORG_ID

    from backend.models.user import UserProfile
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found. Complete onboarding first.",
        )
    return profile.org_id
