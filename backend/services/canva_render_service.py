"""Render content using Canva brand templates via the Autofill API.

Flow: Autofill brand template with content data → export as PNG/PDF → download.
Falls back to None on any failure so the caller can use the built-in engine.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from backend.services.org_config_service import get_org_config, upsert_org_config

logger = logging.getLogger(__name__)


def render_canva_content(
    db: Session,
    org_id: str,
    design_source: dict,
    content_data: dict,
    content_id: str,
    content_type: str,
    brand_context: dict,
) -> dict | None:
    """Render content using a Canva brand template as source.

    1. Get Canva OAuth token from OrgConfig (refresh if expired)
    2. Build autofill data from content_data + field_map
    3. Create autofill job → wait for completion → get new design ID
    4. Export design as PNG/PDF → wait → download
    5. Save to local renders dir

    Returns dict with file_path, file_name, rendered_html, format — or None on failure.
    """
    config = get_org_config(db, org_id, "canva_config")
    if not config:
        logger.warning("Canva not connected for org %s, falling back to built-in", org_id)
        return None

    template_id = design_source.get("template_id", "")
    field_map = design_source.get("field_map", {})

    if not template_id:
        logger.warning("No Canva template_id in design_source, falling back")
        return None

    # ── 1. Get valid access token (refresh if needed) ──
    try:
        from backend.services.canva_service import get_valid_token
        access_token, updated_config = get_valid_token(config)
        if updated_config:
            upsert_org_config(db, org_id, "canva_config", updated_config)
    except Exception as e:
        logger.error("Canva token refresh failed for org %s: %s", org_id, e)
        return None

    # ── 2. Build autofill data ──
    # Normalize content data (resolve field aliases)
    from tools.content.render_asset import _normalize_visual_data
    normalized = _normalize_visual_data(content_type, content_data)

    # field_map: {template_field_name: canva_dataset_field_name}
    autofill_data: dict = {}
    for field_name, canva_field in field_map.items():
        value = normalized.get(field_name, "")
        if isinstance(value, str) and value:
            autofill_data[canva_field] = {"type": "text", "text": value}
        elif isinstance(value, list):
            # Join array fields into text
            parts = []
            for item in value:
                if isinstance(item, dict):
                    parts.append(f"{item.get('headline', '')}\n{item.get('body', '')}")
                elif isinstance(item, str):
                    parts.append(item)
            if parts:
                autofill_data[canva_field] = {"type": "text", "text": "\n\n".join(parts)}

    # Add brand fields if mapped
    if "brand_name" in field_map and brand_context.get("name"):
        autofill_data[field_map["brand_name"]] = {"type": "text", "text": brand_context["name"]}
    if "brand_website" in field_map and brand_context.get("website"):
        autofill_data[field_map["brand_website"]] = {"type": "text", "text": brand_context["website"]}

    if not autofill_data:
        logger.warning("No autofill data to send to Canva, falling back")
        return None

    # ── 3. Create and wait for autofill job ──
    try:
        from backend.services.canva_service import (
            create_autofill,
            wait_for_autofill,
            create_export,
            wait_for_export,
            download_file,
        )

        autofill_result = create_autofill(access_token, template_id, autofill_data)
        job_id = autofill_result.get("job", {}).get("id", "")
        if not job_id:
            logger.error("Canva autofill returned no job ID: %s", autofill_result)
            return None

        completed = wait_for_autofill(access_token, job_id, max_wait=60)
        design_id = completed.get("job", {}).get("result", {}).get("design", {}).get("id", "")
        if not design_id:
            logger.error("Canva autofill completed but no design ID: %s", completed)
            return None

        logger.info("Canva autofill complete, design_id=%s", design_id)

    except Exception as e:
        logger.error("Canva autofill failed for org %s: %s", org_id, e)
        return None

    # ── 4. Export design as PNG ──
    output_format = "png"
    try:
        export_result = create_export(access_token, design_id, fmt=output_format)
        export_id = export_result.get("job", {}).get("id", "")
        if not export_id:
            logger.error("Canva export returned no job ID: %s", export_result)
            return None

        urls = wait_for_export(access_token, export_id, max_wait=60)
        if not urls:
            logger.error("Canva export completed but no download URLs")
            return None

        file_bytes = download_file(urls[0])
    except Exception as e:
        logger.error("Canva export failed for org %s: %s", org_id, e)
        return None

    # ── 5. Save to local file ──
    from tools.content.render_asset import RENDERS_DIR
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    output_id = content_id or str(uuid.uuid4())
    output_path = RENDERS_DIR / f"{output_id}.{output_format}"
    output_path.write_bytes(file_bytes)

    logger.info("Canva render complete: %s (%s, %d bytes)", output_path.name, output_format, len(file_bytes))

    return {
        "file_path": str(output_path),
        "file_name": f"{output_id}.{output_format}",
        "rendered_html": "",  # Canva exports are binary, no HTML
        "format": output_format,
    }
