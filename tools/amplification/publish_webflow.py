"""
Publish content as Webflow CMS items (blog posts or landing pages).

Usage:
    python tools/amplification/publish_webflow.py --content-id 42 --type blog

Requires:
    - WEBFLOW_API_TOKEN in .env
    - Webflow CMS collections created with matching fields
"""
import json

import httpx

from tools.config import Config

WEBFLOW_BASE = "https://api.webflow.com/v2"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {Config.WEBFLOW_API_TOKEN}",
        "Content-Type": "application/json",
    }


def publish_blog(content_data: dict, language: str) -> dict:
    """Publish a blog post to Webflow CMS."""
    if not Config.WEBFLOW_API_TOKEN or not Config.WEBFLOW_BLOG_COLLECTION_ID:
        return _mock_result("blog", content_data)

    fields = {
        "name": content_data.get("title", "Untitled"),
        "slug": _slugify(content_data.get("title", "untitled")),
        "post-body": _content_to_html(content_data),
        "meta-description": content_data.get("meta_description", ""),
        "language": language,
    }

    return _create_item(Config.WEBFLOW_BLOG_COLLECTION_ID, fields)


def publish_landing(content_data: dict, language: str) -> dict:
    """Publish a landing page to Webflow CMS."""
    if not Config.WEBFLOW_API_TOKEN or not Config.WEBFLOW_LANDING_COLLECTION_ID:
        return _mock_result("landing", content_data)

    fields = {
        "name": content_data.get("title", "Untitled"),
        "slug": _slugify(content_data.get("title", "untitled")),
        "page-body": _content_to_html(content_data),
        "meta-description": content_data.get("meta_description", ""),
        "cta-text": content_data.get("cta", "Learn More"),
        "language": language,
    }

    return _create_item(Config.WEBFLOW_LANDING_COLLECTION_ID, fields)


def _create_item(collection_id: str, fields: dict, is_draft: bool = True) -> dict:
    """Create a Webflow CMS item."""
    payload = {
        "fieldData": fields,
        "isDraft": is_draft,
    }

    response = httpx.post(
        f"{WEBFLOW_BASE}/collections/{collection_id}/items",
        headers=_headers(),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    return {
        "id": data.get("id", ""),
        "url": f"https://{Config.WEBFLOW_SITE_ID}.webflow.io/{fields.get('slug', '')}",
        "status": "draft" if is_draft else "published",
    }


def _content_to_html(content_data: dict) -> str:
    """Convert content data to simple HTML for Webflow rich text field."""
    parts = []
    if "sections" in content_data:
        for section in content_data["sections"]:
            parts.append(f"<h2>{section.get('heading', '')}</h2>")
            parts.append(f"<p>{section.get('body', '')}</p>")
    if "conclusion" in content_data:
        parts.append(f"<h2>Conclusion</h2><p>{content_data['conclusion']}</p>")
    if "body" in content_data:
        parts.append(f"<p>{content_data['body']}</p>")
    return "\n".join(parts) if parts else "<p>Content pending</p>"


def _slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    import re
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug[:80]


def _mock_result(content_type: str, content_data: dict) -> dict:
    return {
        "id": f"mock_webflow_{content_type}",
        "url": f"https://mock.webflow.io/{_slugify(content_data.get('title', 'untitled'))}",
        "status": "mock",
    }
