from __future__ import annotations

from sqlalchemy import Column, String, DateTime, ForeignKey, func
from backend.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True)  # matches Supabase auth.users.id
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    email = Column(String(200), nullable=False)
    full_name = Column(String(200), default="")
    role = Column(String(20), default="member")  # owner, admin, member
    avatar_url = Column(String(500), default="")
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<UserProfile {self.email} [{self.role}]>"
