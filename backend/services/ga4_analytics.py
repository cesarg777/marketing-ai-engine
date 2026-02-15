from __future__ import annotations

import json
import logging
import uuid
from datetime import date

from sqlalchemy.orm import Session

from backend.models.metrics import PlatformMetric
from backend.services.org_config_service import get_org_config

logger = logging.getLogger(__name__)

GA4_CONFIG_KEY = "ga4_config"


def sync_metrics(db: Session, org_id: str) -> dict:
    """Fetch GA4 metrics for the last 30 days and store as PlatformMetric records.

    Returns a sync summary dict.
    """
    config = get_org_config(db, org_id, GA4_CONFIG_KEY)
    if not config:
        raise ValueError("GA4 not connected. Connect it in Settings first.")

    sa_json_str = config.get("service_account_json", "")
    property_id = config.get("property_id", "")

    if not sa_json_str or not property_id:
        raise ValueError("GA4 configuration incomplete.")

    try:
        sa_info = json.loads(sa_json_str) if isinstance(sa_json_str, str) else sa_json_str
    except json.JSONDecodeError:
        raise ValueError("Invalid service account JSON stored.")

    # Import Google libraries
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric,
    )
    from google.oauth2.service_account import Credentials

    credentials = Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/analytics.readonly"],
    )
    client = BetaAnalyticsDataClient(credentials=credentials)

    # Fetch report: last 30 days, by date + pagePath
    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        dimensions=[
            Dimension(name="date"),
            Dimension(name="pagePath"),
        ],
        metrics=[
            Metric(name="sessions"),
            Metric(name="screenPageViews"),
            Metric(name="activeUsers"),
        ],
        limit=10000,
        order_bys=[],
    )

    try:
        response = client.run_report(request)
    except Exception as e:
        logger.error("GA4 report request failed for org %s: %s", org_id, e)
        raise ValueError(f"GA4 API error: {str(e)[:200]}")

    synced = 0
    total_sessions = 0
    total_pageviews = 0
    page_sessions: dict[str, int] = {}

    for row in response.rows:
        row_date_str = row.dimension_values[0].value  # YYYYMMDD
        page_path = row.dimension_values[1].value
        sessions = int(row.metric_values[0].value)
        pageviews = int(row.metric_values[1].value)
        users = int(row.metric_values[2].value)

        row_date = date(
            int(row_date_str[:4]),
            int(row_date_str[4:6]),
            int(row_date_str[6:8]),
        )

        # Limit to top 100 pages per date (skip tiny pages)
        if sessions == 0 and pageviews == 0:
            continue

        # Upsert
        existing = (
            db.query(PlatformMetric)
            .filter(
                PlatformMetric.org_id == org_id,
                PlatformMetric.platform == "ga4",
                PlatformMetric.date == row_date,
                PlatformMetric.page_path == page_path,
            )
            .first()
        )

        if existing:
            existing.sessions = sessions
            existing.pageviews = pageviews
            existing.users = users
        else:
            db.add(PlatformMetric(
                id=str(uuid.uuid4()),
                org_id=org_id,
                platform="ga4",
                date=row_date,
                page_path=page_path,
                sessions=sessions,
                pageviews=pageviews,
                users=users,
            ))

        total_sessions += sessions
        total_pageviews += pageviews
        page_sessions[page_path] = page_sessions.get(page_path, 0) + sessions
        synced += 1

    db.commit()

    # Top 10 pages by sessions
    top_pages = sorted(page_sessions.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "platform": "ga4",
        "synced": synced,
        "summary": {
            "total_sessions": total_sessions,
            "total_pageviews": total_pageviews,
            "top_pages": [{"path": p, "sessions": s} for p, s in top_pages],
        },
    }
