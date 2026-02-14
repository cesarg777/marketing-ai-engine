from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models.content import ContentItem
from backend.models.metrics import ContentMetric, WeeklyReport
from backend.models.template import ContentTemplate
from backend.schemas.metrics import (
    MetricImportRequest, MetricResponse, DashboardResponse, WeeklyReportResponse,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    total_content = db.query(ContentItem).count()
    total_published = db.query(ContentItem).filter(ContentItem.status == "published").count()

    agg = db.query(
        func.coalesce(func.sum(ContentMetric.impressions), 0),
        func.coalesce(func.sum(ContentMetric.engagement), 0),
    ).first()

    # Top content by engagement
    top = (
        db.query(ContentItem, func.sum(ContentMetric.engagement).label("eng"))
        .join(ContentMetric, ContentMetric.content_item_id == ContentItem.id)
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
        .group_by(ContentTemplate.content_type)
        .all()
    )

    # Content by language
    by_lang = (
        db.query(ContentItem.language, func.count(ContentItem.id))
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
def import_metric(data: MetricImportRequest, db: Session = Depends(get_db)):
    metric = ContentMetric(**data.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.post("/import/linkedin")
def import_linkedin_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload LinkedIn analytics CSV and parse metrics."""
    import csv
    import io

    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    imported = 0
    for row in reader:
        # Map LinkedIn CSV columns to our schema
        # This will need adjustment based on actual LinkedIn export format
        metric = ContentMetric(
            content_item_id=int(row.get("content_id", 0)),
            channel="linkedin",
            date=date.fromisoformat(row.get("date", str(date.today()))),
            impressions=int(row.get("impressions", 0)),
            reach=int(row.get("reach", 0)),
            engagement=int(row.get("reactions", 0)) + int(row.get("comments", 0)),
            clicks=int(row.get("clicks", 0)),
        )
        db.add(metric)
        imported += 1
    db.commit()
    return {"detail": f"Imported {imported} metric records"}


@router.get("/content/{content_id}", response_model=list[MetricResponse])
def get_content_metrics(content_id: int, db: Session = Depends(get_db)):
    return (
        db.query(ContentMetric)
        .filter(ContentMetric.content_item_id == content_id)
        .order_by(ContentMetric.date.desc())
        .all()
    )


@router.get("/reports", response_model=list[WeeklyReportResponse])
def list_reports(limit: int = 10, db: Session = Depends(get_db)):
    return (
        db.query(WeeklyReport)
        .order_by(WeeklyReport.week_start.desc())
        .limit(limit)
        .all()
    )


@router.post("/reports/generate")
def generate_weekly_report(week_start: date, db: Session = Depends(get_db)):
    """Trigger AI-powered weekly performance evaluation."""
    from backend.services.metrics_service import generate_report
    report = generate_report(db=db, week_start=week_start)
    return WeeklyReportResponse.model_validate(report)
