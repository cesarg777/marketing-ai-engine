from __future__ import annotations

import logging
import os
import jwt as pyjwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config
from backend.database import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Dev-mode default org ID (used when no Supabase JWT is configured)
DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"

# Explicitly check for dev mode via environment variable
_IS_DEV_MODE = os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "local")

# JWKS client for ES256 token verification (Supabase's current signing algorithm)
_jwks_client: PyJWKClient | None = None
if Config.SUPABASE_URL:
    _jwks_url = f"{Config.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    _jwks_client = PyJWKClient(_jwks_url, cache_keys=True, lifespan=3600)
    logger.info("JWKS client initialized: %s", _jwks_url)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """Decode Supabase JWT and return the payload.

    Supports both ES256 (JWKS) and HS256 (JWT secret) algorithms.
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
    if not jwt_secret and not _jwks_client:
        if _IS_DEV_MODE:
            logger.warning("Auth bypass: no JWT secret configured (dev mode)")
            return {"sub": "dev-user", "email": "dev@localhost", "role": "authenticated"}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured",
        )

    try:
        # Peek at the token header to determine the algorithm
        header = pyjwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256" and _jwks_client:
            # ES256: verify with Supabase JWKS public key
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                options={"require": ["sub", "exp", "iat"]},
            )
        elif jwt_secret:
            # HS256 fallback: verify with JWT secret
            payload = pyjwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["sub", "exp", "iat"]},
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported token algorithm",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (pyjwt.InvalidTokenError, Exception) as e:
        logger.warning("JWT validation failed: %s", str(e))
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
