from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.language import Language
from backend.schemas.language import LanguageCreate, LanguageUpdate, LanguageResponse
from backend.security import validate_uuid, safe_update, LANGUAGE_UPDATE_FIELDS

router = APIRouter()


@router.get("/", response_model=list[LanguageResponse])
def list_languages(
    active_only: bool = False,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    query = db.query(Language)
    if active_only:
        query = query.filter(Language.is_active == True)
    return query.order_by(Language.code).all()


@router.get("/{language_id}", response_model=LanguageResponse)
def get_language(
    language_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(language_id, "language_id")
    lang = db.query(Language).filter(Language.id == language_id).first()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")
    return lang


@router.post("/", response_model=LanguageResponse, status_code=201)
def create_language(
    data: LanguageCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    existing = db.query(Language).filter(Language.code == data.code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Language '{data.code}' already exists")
    lang = Language(**data.model_dump())
    db.add(lang)
    db.commit()
    db.refresh(lang)
    return lang


@router.put("/{language_id}", response_model=LanguageResponse)
def update_language(
    language_id: str,
    data: LanguageUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(language_id, "language_id")
    lang = db.query(Language).filter(Language.id == language_id).first()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")
    safe_update(lang, data.model_dump(exclude_unset=True), LANGUAGE_UPDATE_FIELDS)
    db.commit()
    db.refresh(lang)
    return lang


@router.delete("/{language_id}")
def delete_language(
    language_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(language_id, "language_id")
    lang = db.query(Language).filter(Language.id == language_id).first()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")
    db.delete(lang)
    db.commit()
    return {"detail": "Language deleted"}
