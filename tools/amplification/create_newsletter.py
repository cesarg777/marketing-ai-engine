"""
Create and send newsletters from top-performing content via Resend API.

Usage:
    python tools/amplification/create_newsletter.py --week 2026-02-09
"""
import json

import anthropic

from tools.config import Config

NEWSLETTER_SYSTEM = """You are a newsletter editor for Siete, a B2B company.
Compose a weekly newsletter from the provided top-performing content pieces.

Structure:
- subject: Compelling email subject line (under 50 chars)
- preview_text: Email preview text (under 100 chars)
- intro: Brief intro paragraph welcoming readers
- sections: Array of {title, summary, cta_text, cta_url} — one per content piece
- outro: Closing paragraph with next week preview

Tone: Professional, helpful, value-packed. No fluff.
Return valid JSON only."""


def compose(content_list: list[dict], language: str = "en") -> dict:
    """Compose a newsletter from multiple content items."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_newsletter(content_list)

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    content_str = json.dumps(content_list, ensure_ascii=False, indent=2)

    user_prompt = f"""Compose a weekly newsletter from these top-performing content pieces.
Language: {language}

Content items:
{content_str}

Return valid JSON with: subject, preview_text, intro, sections (array), outro"""

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=3000,
        system=NEWSLETTER_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = response.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    newsletter = json.loads(text[start:end])

    # Generate HTML from the newsletter data
    newsletter["html"] = _render_html(newsletter)
    return newsletter


def send_single(content_data: dict, language: str) -> dict:
    """Send a single content item as a newsletter."""
    if not Config.RESEND_API_KEY:
        return {"id": "mock_email", "status": "mock"}

    import resend
    resend.api_key = Config.RESEND_API_KEY

    # TODO: Get recipients from system config
    result = resend.Emails.send({
        "from": Config.NEWSLETTER_FROM_EMAIL,
        "to": [],  # Populated from system config
        "subject": content_data.get("title", "Newsletter from Siete"),
        "html": _render_html(content_data),
    })
    return {"id": result.get("id", ""), "status": "sent"}


def _render_html(data: dict) -> str:
    """Simple HTML template for newsletter."""
    sections_html = ""
    for section in data.get("sections", []):
        sections_html += f"""
        <div style="margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <h2 style="color: #1a1a1a; margin: 0 0 8px;">{section.get('title', '')}</h2>
            <p style="color: #4a4a4a; margin: 0 0 12px;">{section.get('summary', '')}</p>
        </div>"""

    return f"""
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h1 style="color: #1a1a1a;">Siete Weekly</h1>
        <p>{data.get('intro', '')}</p>
        {sections_html}
        <p style="color: #666; font-size: 14px; margin-top: 32px;">{data.get('outro', '')}</p>
    </div>"""


def _mock_newsletter(content_list: list[dict]) -> dict:
    return {
        "subject": "[MOCK] This Week in B2B",
        "preview_text": "Top insights from this week",
        "intro": "Here's what performed best this week.",
        "sections": [
            {"title": item.get("title", "Item"), "summary": "Mock summary", "cta_text": "Read more", "cta_url": "#"}
            for item in content_list[:3]
        ],
        "outro": "See you next week!",
        "html": "<p>Mock newsletter HTML</p>",
    }
