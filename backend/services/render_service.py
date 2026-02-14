from __future__ import annotations
from pathlib import Path
from sqlalchemy.orm import Session
from backend.models.content import ContentItem
from backend.models.template import ContentTemplate
from backend.services.storage_service import upload_file, BUCKET_RENDERS


def render_content_item(
    db: Session,
    item: ContentItem,
    template: ContentTemplate,
) -> dict:
    """Render a content item into a visual asset (PNG/PDF).

    Returns dict with: file_name, asset_url, rendered_html, format
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

    # Upload rendered file to storage
    file_path = Path(result["file_path"])
    file_name = result["file_name"]
    content_type = "application/pdf" if result["format"] == "pdf" else "image/png"

    asset_url = upload_file(
        bucket=BUCKET_RENDERS,
        path=file_name,
        data=file_path.read_bytes(),
        content_type=content_type,
    )

    # Save rendered HTML to database
    item.rendered_html = result["rendered_html"]
    db.commit()
    db.refresh(item)

    return {
        "file_name": file_name,
        "asset_url": asset_url,
        "rendered_html": result["rendered_html"],
        "format": result["format"],
    }
