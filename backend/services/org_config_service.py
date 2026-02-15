from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.config import OrgConfig


def get_org_config(db: Session, org_id: str, key: str) -> dict | None:
    config = db.query(OrgConfig).filter(
        OrgConfig.org_id == org_id, OrgConfig.key == key,
    ).first()
    if config and isinstance(config.value, dict):
        return config.value
    return None


def upsert_org_config(db: Session, org_id: str, key: str, value: dict):
    existing = db.query(OrgConfig).filter(
        OrgConfig.org_id == org_id, OrgConfig.key == key,
    ).first()
    if existing:
        existing.value = value
    else:
        db.add(OrgConfig(org_id=org_id, key=key, value=value))
    db.commit()


def delete_org_config(db: Session, org_id: str, key: str):
    config = db.query(OrgConfig).filter(
        OrgConfig.org_id == org_id, OrgConfig.key == key,
    ).first()
    if config:
        db.delete(config)
        db.commit()


def mask_secret(value: str) -> str:
    return "****" + value[-4:] if len(value) > 4 else "****"
