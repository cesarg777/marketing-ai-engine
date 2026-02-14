from __future__ import annotations
from sqlalchemy.orm import Session
from backend.models.content import ContentItem
from backend.models.template import ContentTemplate


def render_content_item(
    db: Session,
    item: ContentItem,
    template: ContentTemplate,
) -> dict:
    """Render a content item into a visual asset (PNG/PDF).

    Returns dict with: file_path, file_name, rendered_html, format
    """
    from tools.content.render_asset import render, VISUAL_TYPES

    if template.content_type not in VISUAL_TYPES:
        raise ValueError(
            f"Template type '{template.content_type}' does not support visual rendering. "
            f"Supported: {', '.join(VISUAL_TYPES)}"
        )

    result = render(
        content_type=template.content_type,
        content_data=item.content_data or {},
        content_id=item.id,
        visual_layout_override=template.visual_layout or None,
        visual_css_override=template.visual_css or None,
    )

    # Save rendered HTML to database
    item.rendered_html = result["rendered_html"]
    db.commit()
    db.refresh(item)

    return result
