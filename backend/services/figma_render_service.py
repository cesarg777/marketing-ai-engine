"""Render content using Figma designs as source.

Flow: Export SVG from Figma → replace text with generated content → render with Playwright.
Falls back to None on any failure so the caller can use the built-in engine.
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from backend.services.org_config_service import get_org_config

logger = logging.getLogger(__name__)

# SVG cache to avoid hitting Figma rate limits on repeated renders
_CACHE_DIR: Path | None = None
_CACHE_MAX_AGE_SECONDS = 3600  # 1 hour


def _get_cache_dir() -> Path:
    global _CACHE_DIR
    if _CACHE_DIR is None:
        from tools.config import Config
        _CACHE_DIR = Config.TMP_DIR / "figma_cache"
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR


def _cache_key(file_key: str, node_id: str) -> str:
    return hashlib.md5(f"{file_key}:{node_id}".encode()).hexdigest()


def _get_cached_svg(file_key: str, node_id: str) -> str | None:
    """Return cached SVG content if fresh enough."""
    cache_file = _get_cache_dir() / f"{_cache_key(file_key, node_id)}.svg"
    if not cache_file.exists():
        return None
    age = time.time() - cache_file.stat().st_mtime
    if age > _CACHE_MAX_AGE_SECONDS:
        cache_file.unlink(missing_ok=True)
        return None
    return cache_file.read_text(encoding="utf-8")


def _save_cached_svg(file_key: str, node_id: str, svg_content: str) -> None:
    """Write SVG content to cache."""
    cache_file = _get_cache_dir() / f"{_cache_key(file_key, node_id)}.svg"
    cache_file.write_text(svg_content, encoding="utf-8")


def render_figma_content(
    db: Session,
    org_id: str,
    design_source: dict,
    content_data: dict,
    content_id: str,
    content_type: str,
    brand_context: dict,
) -> dict | None:
    """Render content using a Figma design as source.

    1. Get Figma PAT from OrgConfig
    2. Export the linked frame as SVG (with caching)
    3. Replace text layers with generated content using field_map
    4. Wrap SVG in HTML and render with Playwright

    Returns dict with file_path, file_name, rendered_html, format — or None on failure.
    """
    config = get_org_config(db, org_id, "figma_config")
    if not config:
        logger.warning("Figma not connected for org %s, falling back to built-in", org_id)
        return None

    token = config.get("token", "")
    file_key = design_source.get("file_key", "")
    node_id = design_source.get("frame_id", "")
    field_map = design_source.get("field_map", {})

    if not token or not file_key or not node_id:
        logger.warning("Incomplete Figma design_source config, falling back")
        return None

    # ── 1. Get SVG (from cache or Figma API) ──
    try:
        svg_content = _get_cached_svg(file_key, node_id)
        if svg_content:
            logger.debug("Using cached Figma SVG for %s:%s", file_key, node_id)
        else:
            from backend.services.figma_service import export_frame_svg, download_content
            svg_url = export_frame_svg(token, file_key, node_id)
            svg_bytes = download_content(svg_url)
            svg_content = svg_bytes.decode("utf-8")
            _save_cached_svg(file_key, node_id, svg_content)
            logger.info("Fetched and cached Figma SVG for %s:%s", file_key, node_id)
    except Exception as e:
        logger.error("Figma SVG export failed for org %s: %s", org_id, e)
        return None

    # ── 2. Build text replacements from content_data + field_map ──
    from tools.content.render_asset import _replace_svg_text, _normalize_visual_data, TEMPLATE_MAP

    # Normalize content data (resolve field aliases, build arrays, etc.)
    normalized = _normalize_visual_data(content_type, content_data)

    # field_map: {template_field_name: figma_layer_name}
    # _replace_svg_text matches by checking if field_name is contained in element id
    replacements: dict[str, str] = {}
    for field_name, layer_name in field_map.items():
        value = normalized.get(field_name, "")
        if isinstance(value, str) and value:
            replacements[layer_name] = value
        elif isinstance(value, list):
            # For array fields like slides, join into text
            parts = []
            for item in value:
                if isinstance(item, dict):
                    parts.append(f"{item.get('headline', '')}\n{item.get('body', '')}")
                elif isinstance(item, str):
                    parts.append(item)
            if parts:
                replacements[layer_name] = "\n\n".join(parts)

    # Add brand fields (always available for matching)
    replacements["brand_name"] = brand_context.get("name", "")
    replacements["brand_website"] = brand_context.get("website", "")

    # ── 3. Replace text in SVG ──
    modified_svg = _replace_svg_text(svg_content, replacements)

    # ── 4. Wrap in HTML and render with Playwright ──
    config_entry = TEMPLATE_MAP.get(content_type, {"width": 1080, "height": 1080, "format": "png"})
    dimensions = design_source.get("dimensions", {})
    width = dimensions.get("width", config_entry["width"])
    height = dimensions.get("height", config_entry["height"])
    output_format = config_entry.get("format", "png")

    rendered_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ width: {width}px; height: {height}px; overflow: hidden; background: white; }}
svg {{ width: 100%; height: 100%; }}
</style>
</head>
<body>{modified_svg}</body>
</html>"""

    from tools.content.render_asset import RENDERS_DIR
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    output_id = content_id or str(uuid.uuid4())
    output_path = RENDERS_DIR / f"{output_id}.{output_format}"

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
            )
            page.set_content(rendered_html, wait_until="networkidle")
            page.wait_for_timeout(500)  # allow fonts/images to load

            if output_format == "pdf":
                page.pdf(
                    path=str(output_path),
                    width=f"{width}px",
                    height=f"{height}px",
                    print_background=True,
                )
            else:
                page.screenshot(path=str(output_path), full_page=True, type="png")

            browser.close()
    except Exception as e:
        logger.error("Playwright render failed for Figma content: %s", e)
        return None

    logger.info("Figma render complete: %s (%s)", output_path.name, output_format)

    return {
        "file_path": str(output_path),
        "file_name": f"{output_id}.{output_format}",
        "rendered_html": rendered_html,
        "format": output_format,
    }
