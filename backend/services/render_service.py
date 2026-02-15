from __future__ import annotations
from pathlib import Path
from sqlalchemy.orm import Session
from backend.models.content import ContentItem
from backend.models.template import ContentTemplate
from backend.models.organization import Organization
from backend.models.resource import OrgResource
from backend.models.template_asset import TemplateAsset
from backend.services.storage_service import upload_file, BUCKET_RENDERS


def _build_brand_context(db: Session, org_id: str) -> dict:
    """Build brand context dict from Organization + OrgResource + ICP profile."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    brand = {
        "name": org.name if org else "",
        "logo_url": org.logo_url if org and org.logo_url else "",
        "website": "",
        "accent_color": "",
    }

    # Extract brand_voice settings if available
    if org and isinstance(org.brand_voice, dict):
        brand["website"] = org.brand_voice.get("website", "")
        brand["accent_color"] = org.brand_voice.get("accent_color", "")

    # Check OrgResource for logo (higher priority than org.logo_url)
    logo_resource = (
        db.query(OrgResource)
        .filter(
            OrgResource.org_id == org_id,
            OrgResource.resource_type == "logo",
            OrgResource.is_active == True,
        )
        .order_by(OrgResource.created_at.desc())
        .first()
    )
    if logo_resource and logo_resource.file_url:
        brand["logo_url"] = logo_resource.file_url

    # Check OrgResource for color_palette
    color_resource = (
        db.query(OrgResource)
        .filter(
            OrgResource.org_id == org_id,
            OrgResource.resource_type == "color_palette",
            OrgResource.is_active == True,
        )
        .first()
    )
    if color_resource and isinstance(color_resource.metadata_json, dict):
        if not brand["accent_color"]:
            brand["accent_color"] = color_resource.metadata_json.get("primary_color", "")

    # Check ICP profile for company description / website
    from backend.services.org_config_service import get_org_config
    icp = get_org_config(db, org_id, "icp_profile")
    if icp and not brand["website"]:
        brand["website"] = icp.get("website", "")

    return brand


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

    # Fetch org brand context
    brand_context = _build_brand_context(db, item.org_id)

    # Fetch template-specific assets (non-reference assets for rendering)
    template_assets_query = (
        db.query(TemplateAsset)
        .filter(
            TemplateAsset.template_id == template.id,
            TemplateAsset.asset_type != "reference_file",
        )
        .order_by(TemplateAsset.sort_order)
        .all()
    )
    template_assets = [
        {"asset_type": a.asset_type, "file_url": a.file_url, "name": a.name}
        for a in template_assets_query
    ]

    result = render(
        content_type=template.content_type,
        content_data=item.content_data or {},
        content_id=item.id,
        visual_layout_override=template.visual_layout or None,
        visual_css_override=template.visual_css or None,
        template_assets=template_assets,
        brand_context=brand_context,
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
