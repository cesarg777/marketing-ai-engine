from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime


class LanguageCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=10, pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")
    name: str = Field(..., min_length=1, max_length=100)
    native_name: str = Field(..., min_length=1, max_length=100)
    flag_emoji: str = Field(default="", max_length=10)
    is_active: bool = True


class LanguageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    native_name: str | None = Field(default=None, min_length=1, max_length=100)
    flag_emoji: str | None = Field(default=None, max_length=10)
    is_active: bool | None = None


class LanguageResponse(BaseModel):
    id: str
    code: str
    name: str
    native_name: str
    flag_emoji: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
