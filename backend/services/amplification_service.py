from sqlalchemy.orm import Session
from backend.models.content import ContentItem
from backend.models.template import ContentTemplate


def create_blog_from_content(db: Session, source: ContentItem) -> ContentItem:
    """Expand a short-form content item into a full blog post."""
    from tools.amplification.create_blog_post import expand_to_blog

    blog_data = expand_to_blog(
        source_content=source.content_data,
        source_type=source.template.content_type if source.template else "generic",
        language=source.language,
        tone=source.tone,
    )

    # Find or use the blog_post template
    blog_template = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.content_type == "blog_post", ContentTemplate.is_active == True)
        .first()
    )

    item = ContentItem(
        problem_id=source.problem_id,
        template_id=blog_template.id if blog_template else source.template_id,
        title=blog_data.get("title", f"Blog: {source.title}"),
        language=source.language,
        country=source.country,
        status="draft",
        content_data=blog_data,
        tone=source.tone,
        parent_id=source.id,
        generation_model=blog_data.get("_model", ""),
        generation_tokens=blog_data.get("_tokens", 0),
    )
    db.add(item)

    source.status = "amplified"
    db.commit()
    db.refresh(item)
    return item


def compose_newsletter(db: Session, items: list[ContentItem]) -> dict:
    """Compose a newsletter from multiple content items."""
    from tools.amplification.create_newsletter import compose

    language = items[0].language if items else "en"
    content_list = [
        {"title": item.title, "content_data": item.content_data, "type": item.template.content_type if item.template else "generic"}
        for item in items
    ]
    newsletter = compose(content_list=content_list, language=language)
    return {
        "subject": newsletter.get("subject", ""),
        "preview_text": newsletter.get("preview_text", ""),
        "html": newsletter.get("html", ""),
        "content_ids": [item.id for item in items],
    }


def send_newsletter_email(db: Session, newsletter_id: int) -> dict:
    """Send newsletter via Resend. Placeholder for MVP."""
    # TODO: Implement with Resend API when ready
    return {"status": "not_implemented", "message": "Configure Resend API key to enable sending"}


def create_webflow_landing(db: Session, source: ContentItem) -> dict:
    """Create a landing page in Webflow from content."""
    from tools.amplification.publish_webflow import publish_landing

    result = publish_landing(source.content_data, source.language)
    source.status = "amplified"
    db.commit()
    return result
