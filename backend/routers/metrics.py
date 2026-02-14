from __future__ import annotations
import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.auth import get_current_org_id
from backend.models.content import ContentItem
from backend.models.metrics import ContentMetric, WeeklyReport
from backend.models.template import ContentTemplate
from backend.schemas.metrics import (
    MetricImportRequest, MetricResponse, DashboardResponse, WeeklyReportResponse,
)
from backend.security import validate_csv_upload, validate_uuid

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    total_content = db.query(ContentItem).filter(ContentItem.org_id == org_id).count()
    total_published = (
        db.query(ContentItem)
        .filter(ContentItem.org_id == org_id, ContentItem.status == "published")
        .count()
    )

    agg = (
        db.query(
            func.coalesce(func.sum(ContentMetric.impressions), 0),
            func.coalesce(func.sum(ContentMetric.engagement), 0),
        )
        .join(ContentItem, ContentMetric.content_item_id == ContentItem.id)
        .filter(ContentItem.org_id == org_id)
        .first()
    )

    # Top content by engagement
    top = (
        db.query(ContentItem, func.sum(ContentMetric.engagement).label("eng"))
        .join(ContentMetric, ContentMetric.content_item_id == ContentItem.id)
        .filter(ContentItem.org_id == org_id)
        .group_by(ContentItem.id)
        .order_by(func.sum(ContentMetric.engagement).desc())
        .limit(5)
        .all()
    )
    top_content = [
        {"id": item.id, "title": item.title, "engagement": eng or 0}
        for item, eng in top
    ]

    # Content by type
    by_type = (
        db.query(ContentTemplate.content_type, func.count(ContentItem.id))
        .join(ContentTemplate, ContentTemplate.id == ContentItem.template_id)
        .filter(ContentItem.org_id == org_id)
        .group_by(ContentTemplate.content_type)
        .all()
    )

    # Content by language
    by_lang = (
        db.query(ContentItem.language, func.count(ContentItem.id))
        .filter(ContentItem.org_id == org_id)
        .group_by(ContentItem.language)
        .all()
    )

    return DashboardResponse(
        total_content=total_content,
        total_published=total_published,
        total_impressions=agg[0] if agg else 0,
        total_engagement=agg[1] if agg else 0,
        top_content=top_content,
        content_by_type={t: c for t, c in by_type},
        content_by_language={l: c for l, c in by_lang},
    )


@router.post("/import/manual", response_model=MetricResponse)
def import_metric(
    data: MetricImportRequest,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Verify content ownership
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == data.content_item_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    metric = ContentMetric(**data.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.post("/import/linkedin")
def import_linkedin_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Upload LinkedIn analytics CSV and parse metrics."""
    import csv
    import io

    # Validate file type
    validate_csv_upload(file.content_type, 0)  # type check first

    # Read with size limit
    raw = file.file.read(5 * 1024 * 1024 + 1)  # read up to limit + 1
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")

    reader = csv.DictReader(io.StringIO(content))
    imported = 0
    errors = []
    for row_num, row in enumerate(reader, start=2):  # row 1 is header
        content_item_id = row.get("content_id", "").strip()
        if not content_item_id:
            continue
        # Verify ownership
        item = (
            db.query(ContentItem)
            .filter(ContentItem.id == content_item_id, ContentItem.org_id == org_id)
            .first()
        )
        if not item:
            continue
        try:
            metric = ContentMetric(
                content_item_id=content_item_id,
                channel="linkedin",
                date=date.fromisoformat(row.get("date", str(date.today()))),
                impressions=int(row.get("impressions", 0) or 0),
                reach=int(row.get("reach", 0) or 0),
                engagement=int(row.get("reactions", 0) or 0) + int(row.get("comments", 0) or 0),
                clicks=int(row.get("clicks", 0) or 0),
            )
            db.add(metric)
            imported += 1
        except (ValueError, TypeError) as e:
            errors.append(f"Row {row_num}: {e}")
            continue
    db.commit()
    result = {"detail": f"Imported {imported} metric records"}
    if errors:
        result["warnings"] = errors[:20]  # Cap warning list
    return result


@router.get("/content/{content_id}", response_model=list[MetricResponse])
def get_content_metrics(
    content_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(content_id, "content_id")
    # Verify content ownership
    item = (
        db.query(ContentItem)
        .filter(ContentItem.id == content_id, ContentItem.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    return (
        db.query(ContentMetric)
        .filter(ContentMetric.content_item_id == content_id)
        .order_by(ContentMetric.date.desc())
        .all()
    )


@router.get("/reports", response_model=list[WeeklyReportResponse])
def list_reports(
    limit: int = 10,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    return (
        db.query(WeeklyReport)
        .filter(WeeklyReport.org_id == org_id)
        .order_by(WeeklyReport.week_start.desc())
        .limit(limit)
        .all()
    )


@router.post("/reports/generate")
def generate_weekly_report(
    week_start: date,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Trigger AI-powered weekly performance evaluation."""
    from backend.services.metrics_service import generate_report
    report = generate_report(db=db, week_start=week_start, org_id=org_id)
    return WeeklyReportResponse.model_validate(report)
