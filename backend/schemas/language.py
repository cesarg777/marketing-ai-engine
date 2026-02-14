from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class LanguageCreate(BaseModel):
    code: str
    name: str
    native_name: str
    flag_emoji: str = ""
    is_active: bool = True


class LanguageUpdate(BaseModel):
    name: str | None = None
    native_name: str | None = None
    flag_emoji: str | None = None
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
