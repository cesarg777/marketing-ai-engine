from __future__ import annotations

import logging
import uuid
from datetime import date, datetime

import requests
from sqlalchemy.orm import Session

from backend.models.metrics import PlatformMetric
from backend.services.org_config_service import get_org_config

logger = logging.getLogger(__name__)

LINKEDIN_CONFIG_KEY = "linkedin_config"


def sync_metrics(db: Session, org_id: str) -> dict:
    """Fetch recent LinkedIn post metrics and store as PlatformMetric records.

    Returns a sync summary dict.
    """
    config = get_org_config(db, org_id, LINKEDIN_CONFIG_KEY)
    if not config:
        raise ValueError("LinkedIn not connected. Connect it in Publishing Channels first.")

    access_token = config.get("access_token", "")
    profile_sub = config.get("profile_sub", "")
    if not access_token:
        raise ValueError("LinkedIn access token missing.")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    # Fetch recent posts
    author_urn = f"urn:li:person:{profile_sub}" if profile_sub else None
    posts = _fetch_recent_posts(headers, author_urn)

    synced = 0
    total_impressions = 0
    total_engagement = 0

    for post in posts:
        post_date = _extract_date(post)
        impressions = post.get("impressionsCount", 0) or 0
        reactions = post.get("likeCount", 0) or 0
        comments = post.get("commentCount", 0) or 0
        shares = post.get("shareCount", 0) or 0
        engagement_total = reactions + comments + shares
        post_text = (post.get("commentary", "") or post.get("text", ""))[:200]

        # Upsert: one record per date (aggregate)
        existing = (
            db.query(PlatformMetric)
            .filter(
                PlatformMetric.org_id == org_id,
                PlatformMetric.platform == "linkedin",
                PlatformMetric.date == post_date,
                PlatformMetric.page_path == "/",
            )
            .first()
        )

        if existing:
            existing.impressions = (existing.impressions or 0) + impressions
            existing.engagement = (existing.engagement or 0) + engagement_total
            existing.clicks = (existing.clicks or 0) + (post.get("clickCount", 0) or 0)
        else:
            db.add(PlatformMetric(
                id=str(uuid.uuid4()),
                org_id=org_id,
                platform="linkedin",
                date=post_date,
                page_path="/",
                impressions=impressions,
                engagement=engagement_total,
                clicks=post.get("clickCount", 0) or 0,
                extra_data={"post_count": 1, "last_post_excerpt": post_text},
            ))

        total_impressions += impressions
        total_engagement += engagement_total
        synced += 1

    db.commit()

    return {
        "platform": "linkedin",
        "synced": synced,
        "summary": {
            "total_impressions": total_impressions,
            "total_engagement": total_engagement,
        },
    }


def _fetch_recent_posts(headers: dict, author_urn: str | None) -> list[dict]:
    """Fetch recent posts from LinkedIn REST API."""
    if not author_urn:
        return []

    try:
        url = "https://api.linkedin.com/rest/posts"
        params = {
            "author": author_urn,
            "q": "author",
            "count": 50,
        }
        resp = requests.get(url, headers=headers, params=params, timeout=30)

        if resp.status_code == 401:
            raise ValueError("LinkedIn token expired. Please reconnect in Settings.")
        if resp.status_code == 429:
            logger.warning("LinkedIn rate limit hit")
            return []
        if resp.status_code != 200:
            logger.warning("LinkedIn API returned %d: %s", resp.status_code, resp.text[:200])
            # Fallback: try the older UGC Posts API
            return _fetch_ugc_posts(headers, author_urn)

        data = resp.json()
        return data.get("elements", [])
    except requests.RequestException as e:
        logger.warning("LinkedIn API request failed: %s", e)
        return _fetch_ugc_posts(headers, author_urn)


def _fetch_ugc_posts(headers: dict, author_urn: str) -> list[dict]:
    """Fallback: fetch UGC posts from older LinkedIn API."""
    try:
        url = "https://api.linkedin.com/v2/ugcPosts"
        params = {"q": "authors", "authors": f"List({author_urn})", "count": 50}
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        if resp.status_code != 200:
            logger.warning("LinkedIn UGC API returned %d", resp.status_code)
            return []
        data = resp.json()
        return data.get("elements", [])
    except requests.RequestException as e:
        logger.warning("LinkedIn UGC API request failed: %s", e)
        return []


def _extract_date(post: dict) -> date:
    """Extract the publish date from a LinkedIn post object."""
    # REST API uses publishedAt (ms timestamp)
    ts = post.get("publishedAt") or post.get("createdAt") or post.get("lastModifiedAt")
    if ts and isinstance(ts, (int, float)):
        return datetime.utcfromtimestamp(ts / 1000).date()
    # firstPublishedAt from UGC API
    first = post.get("firstPublishedAt")
    if first and isinstance(first, (int, float)):
        return datetime.utcfromtimestamp(first / 1000).date()
    return date.today()
