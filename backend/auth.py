from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from tools.config import Config

security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


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
