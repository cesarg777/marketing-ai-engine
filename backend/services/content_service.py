from __future__ import annotations
import json
from sqlalchemy.orm import Session
from backend.models.content import ContentItem, Publication
from backend.models.template import ContentTemplate
from backend.models.template_asset import TemplateAsset
from backend.models.research import ResearchProblem
from backend.models.organization import Organization


def generate_content_item(
    db: Session,
    template: ContentTemplate,
    problem: ResearchProblem | None,
    topic: str,
    language: str,
    country: str | None,
    tone: str,
    additional_instructions: str,
    org_id: str,
) -> ContentItem:
    """Generate content using Claude API and save to database."""
    from tools.content.generate_text import generate

    # Build context from problem if available
    problem_context = {}
    if problem:
        problem_context = {
            "title": problem.title,
            "description": problem.description,
            "niche": problem.primary_niche,
            "keywords": problem.keywords,
            "suggested_angles": problem.suggested_angles,
            "trending_direction": problem.trending_direction,
            "related_niches": problem.related_niches or [],
            "source_urls": (problem.source_urls or [])[:5],  # top 5 sources for context
            "country": problem.country,
            "severity": problem.severity,
        }

    # Fetch org info for brand context
    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else ""
    brand_voice = org.brand_voice if org and isinstance(org.brand_voice, dict) else None

    # Fetch reference file assets for this template (images/PDFs for Claude vision)
    ref_assets = (
        db.query(TemplateAsset)
        .filter(
            TemplateAsset.template_id == template.id,
            TemplateAsset.asset_type == "reference_file",
        )
        .order_by(TemplateAsset.sort_order, TemplateAsset.created_at)
        .all()
    )
    reference_files = [
        {"name": a.name, "url": a.file_url, "mime_type": a.mime_type}
        for a in ref_assets
    ]

    content_data = generate(
        template_structure=template.structure,
        template_system_prompt=template.system_prompt,
        topic=topic,
        problem_context=problem_context,
        language=language,
        country=country or "",
        tone=tone,
        additional_instructions=additional_instructions,
        reference_urls=template.reference_urls or [],
        reference_files=reference_files,
        org_name=org_name,
        brand_voice=brand_voice,
    )

    item = ContentItem(
        org_id=org_id,
        problem_id=problem.id if problem else None,
        template_id=template.id,
        title=content_data.get("title", topic),
        language=language,
        country=country,
        status="draft",
        content_data=content_data,
        tone=tone,
        generation_model=content_data.get("_model", ""),
        generation_tokens=content_data.get("_tokens", 0),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def translate_content_item(
    db: Session,
    original: ContentItem,
    target_language: str,
    target_country: str | None,
    org_id: str,
) -> ContentItem:
    """Translate a content item to another language."""
    from tools.content.translate import translate

    translated_data = translate(
        content_data=original.content_data,
        source_language=original.language,
        target_language=target_language,
        target_country=target_country or "",
    )

    item = ContentItem(
        org_id=org_id,
        problem_id=original.problem_id,
        template_id=original.template_id,
        title=translated_data.get("title", original.title),
        language=target_language,
        country=target_country,
        status="draft",
        content_data=translated_data,
        tone=original.tone,
        parent_id=original.id,
        generation_model=translated_data.get("_model", ""),
        generation_tokens=translated_data.get("_tokens", 0),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def publish_content_item(
    db: Session,
    item: ContentItem,
    channel: str,
) -> Publication:
    """Publish content to a specified channel."""
    from backend.models.config import OrgConfig

    external_id = ""
    external_url = ""

    if channel == "webflow_blog":
        from tools.amplification.publish_webflow import publish_blog
        result = publish_blog(item.content_data, item.language)
        external_id = result.get("id", "")
        external_url = result.get("url", "")
    elif channel == "webflow_landing":
        from tools.amplification.publish_webflow import publish_landing
        result = publish_landing(item.content_data, item.language)
        external_id = result.get("id", "")
        external_url = result.get("url", "")
    elif channel == "newsletter":
        from tools.amplification.create_newsletter import send_single
        result = send_single(item.content_data, item.language)
        external_id = result.get("id", "")
    elif channel == "linkedin":
        # Use org's LinkedIn access token
        config = db.query(OrgConfig).filter(
            OrgConfig.org_id == item.org_id, OrgConfig.key == "linkedin_config",
        ).first()
        if config and isinstance(config.value, dict):
            from tools.amplification.publish_linkedin import publish_post
            result = publish_post(
                access_token=config.value.get("access_token", ""),
                profile_sub=config.value.get("profile_sub", ""),
                content_data=item.content_data,
                language=item.language,
            )
            external_id = result.get("id", "")
            external_url = result.get("url", "")
        else:
            external_url = "manual"

    publication = Publication(
        content_item_id=item.id,
        channel=channel,
        external_id=external_id,
        external_url=external_url,
        status="published" if external_url not in ("manual", "") else "pending_manual",
    )
    db.add(publication)

    item.status = "published"
    db.commit()
    db.refresh(publication)
    return publication
