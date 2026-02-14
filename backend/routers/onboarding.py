from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.auth import get_current_user
from backend.models.organization import Organization
from backend.models.user import UserProfile

router = APIRouter()


class OnboardingRequest(BaseModel):
    org_name: str
    org_slug: str


class OnboardingResponse(BaseModel):
    org_id: str
    org_name: str
    org_slug: str
    user_role: str

    model_config = {"from_attributes": True}


@router.post("/setup", response_model=OnboardingResponse)
def setup_org(
    data: OnboardingRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an organization and assign the current user as owner."""
    user_id = user.get("sub", "")
    email = user.get("email", "")

    # Check if user already has a profile (already onboarded)
    existing_profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if existing_profile:
        raise HTTPException(
            status_code=409,
            detail="User already belongs to an organization",
        )

    # Check slug uniqueness
    existing_org = db.query(Organization).filter(Organization.slug == data.org_slug).first()
    if existing_org:
        raise HTTPException(
            status_code=409,
            detail=f"Organization slug '{data.org_slug}' is already taken",
        )

    # Create organization
    org = Organization(name=data.org_name, slug=data.org_slug)
    db.add(org)
    db.flush()  # get org.id before creating profile

    # Create user profile as owner
    profile = UserProfile(
        id=user_id,
        org_id=org.id,
        email=email,
        role="owner",
    )
    db.add(profile)
    db.commit()

    return OnboardingResponse(
        org_id=org.id,
        org_name=org.name,
        org_slug=org.slug,
        user_role="owner",
    )


@router.get("/status")
def onboarding_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current user has completed onboarding."""
    user_id = user.get("sub", "")
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        return {"onboarded": False}
    return {
        "onboarded": True,
        "org_id": profile.org_id,
        "role": profile.role,
    }
