from __future__ import annotations
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models.content import ContentItem
from backend.models.metrics import ContentMetric, WeeklyReport


def generate_report(db: Session, week_start: date, org_id: str = "") -> WeeklyReport:
    """Generate AI-powered weekly performance report."""
    week_end = week_start + timedelta(days=7)

    # Get metrics for the week, scoped to org
    metrics = (
        db.query(
            ContentItem.id,
            ContentItem.title,
            ContentItem.language,
            func.sum(ContentMetric.impressions).label("impressions"),
            func.sum(ContentMetric.engagement).label("engagement"),
            func.sum(ContentMetric.clicks).label("clicks"),
            func.sum(ContentMetric.conversions).label("conversions"),
        )
        .join(ContentMetric, ContentMetric.content_item_id == ContentItem.id)
        .filter(
            ContentItem.org_id == org_id,
            ContentMetric.date >= week_start,
            ContentMetric.date < week_end,
        )
        .group_by(ContentItem.id)
        .order_by(func.sum(ContentMetric.engagement).desc())
        .all()
    )

    if not metrics:
        report = WeeklyReport(
            org_id=org_id,
            week_start=week_start,
            top_content_ids=[],
            ai_insights="No metrics data available for this week.",
            recommendations=[],
            amplification_candidates=[],
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    # Prepare data for Claude analysis
    metrics_summary = [
        {
            "id": m.id,
            "title": m.title,
            "language": m.language,
            "impressions": m.impressions or 0,
            "engagement": m.engagement or 0,
            "clicks": m.clicks or 0,
            "conversions": m.conversions or 0,
        }
        for m in metrics
    ]

    top_ids = [m.id for m in metrics[:5]]
    amplification_ids = [m.id for m in metrics[:3]]

    # Use Claude to generate insights
    try:
        from tools.tracking.evaluate_performance import evaluate
        analysis = evaluate(metrics_summary)
        ai_insights = analysis.get("insights", "")
        recommendations = analysis.get("recommendations", [])
    except Exception:
        ai_insights = f"Top performer: {metrics[0].title} with {metrics[0].engagement} engagements."
        recommendations = [{"action": "Amplify top 3 performers", "priority": "high"}]

    report = WeeklyReport(
        org_id=org_id,
        week_start=week_start,
        top_content_ids=top_ids,
        ai_insights=ai_insights,
        recommendations=recommendations,
        amplification_candidates=amplification_ids,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
