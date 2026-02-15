from __future__ import annotations
"""
Visual asset rendering engine.
Takes content_data + a Jinja2 HTML template and renders to PNG or PDF.

Usage:
    python tools/content/render_asset.py \
        --content-type carousel \
        --content-data '{"title": "Test", "slides": [...]}' \
        --output-path .tmp/renders/test.png
"""
import argparse
import json
import uuid
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright

from tools.config import Config

TEMPLATES_DIR = Path(__file__).parent / "visual_templates"
RENDERS_DIR = Config.TMP_DIR / "renders"

# Content types that produce visual assets
VISUAL_TYPES = {"carousel", "meet_the_team", "meme", "case_study", "infografia"}

# Fields that are metadata or mapped separately — not slide content
_CAROUSEL_SKIP_FIELDS = {"title", "_model", "_tokens", "cta", "social_caption", "social_hashtags"}
_CAROUSEL_CTA_ALIASES = {"cierre", "closing", "cta_text", "call_to_action"}
_CAROUSEL_CAPTION_ALIASES = {"copylinkedin", "copy_linkedin", "linkedin_caption", "caption", "descripcion"}


def _normalize_carousel_data(data: dict) -> dict:
    """Normalize carousel content_data so it matches what carousel.html expects.

    Handles two formats:
    - Standard: {title, slides: [{headline, body}...], cta, social_caption, ...}
    - Flat/custom: {title, caratula, desarrollo1, desarrollo2, ..., cierre, copylinkedin}

    For flat format, builds slides[] from the remaining text fields.
    """
    # Already has slides as a list — use as-is
    if isinstance(data.get("slides"), list) and data["slides"]:
        return data

    normalized = {"title": data.get("title", "")}

    # Map CTA aliases
    cta = data.get("cta", "")
    if not cta:
        for alias in _CAROUSEL_CTA_ALIASES:
            if alias in data and data[alias]:
                cta = data[alias]
                break
    normalized["cta"] = cta

    # Map social_caption aliases
    caption = data.get("social_caption", "")
    if not caption:
        for alias in _CAROUSEL_CAPTION_ALIASES:
            if alias in data and data[alias]:
                caption = data[alias]
                break
    normalized["social_caption"] = caption
    normalized["social_hashtags"] = data.get("social_hashtags", "")

    # Build slides from remaining fields
    skip = _CAROUSEL_SKIP_FIELDS | _CAROUSEL_CTA_ALIASES | _CAROUSEL_CAPTION_ALIASES
    slides = []
    for key, value in data.items():
        if key.lower() in skip or not value or not isinstance(value, str):
            continue
        # Use field name (cleaned up) as headline, value as body
        headline = key.replace("_", " ").replace("-", " ").title()
        slides.append({"headline": headline, "body": value})

    normalized["slides"] = slides

    # Preserve metadata
    if "_model" in data:
        normalized["_model"] = data["_model"]
    if "_tokens" in data:
        normalized["_tokens"] = data["_tokens"]

    return normalized

# Map content_type to template file and output format
TEMPLATE_MAP = {
    "carousel": {"file": "carousel.html", "format": "pdf", "width": 1080, "height": 1080},
    "meet_the_team": {"file": "meet_the_team.html", "format": "png", "width": 1080, "height": 1350},
    "meme": {"file": "meme.html", "format": "png", "width": 1080, "height": 1350},
    "case_study": {"file": "caso_exito.html", "format": "png", "width": 1080, "height": 1350},
    "infografia": {"file": "infografia.html", "format": "png", "width": 1080, "height": 1350},
}


def render(
    content_type: str,
    content_data: dict,
    content_id: str | None = None,
    visual_layout_override: str | None = None,
    visual_css_override: str | None = None,
    template_assets: list[dict] | None = None,
) -> dict:
    """Render content_data into a visual asset (PNG or PDF).

    Args:
        content_type: One of VISUAL_TYPES (e.g. "carousel", "meet_the_team")
        content_data: Dict with all content fields from generation
        content_id: Optional ID for output filename (auto-generated if None)
        visual_layout_override: Optional custom HTML template (overrides file)
        visual_css_override: Optional custom CSS (injected into template)

    Returns:
        dict with keys: file_path, rendered_html, format
    """
    if content_type not in TEMPLATE_MAP:
        raise ValueError(f"Unknown visual content type: {content_type}. Supported: {list(TEMPLATE_MAP.keys())}")

    if not content_data:
        raise ValueError("content_data is empty — cannot render without content")

    # Normalize carousel data (handles both standard slides[] and flat custom fields)
    if content_type == "carousel":
        content_data = _normalize_carousel_data(content_data)
        if not content_data.get("slides"):
            raise ValueError(
                f"Carousel has no renderable slides. "
                f"Original keys: {list(content_data.keys())}"
            )

    config = TEMPLATE_MAP[content_type]
    output_id = content_id or str(uuid.uuid4())

    # Render HTML from Jinja2 template
    if visual_layout_override:
        env = Environment(autoescape=True)
        template = env.from_string(visual_layout_override)
    else:
        env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=True,
        )
        template = env.get_template(config["file"])

    # Build assets dict keyed by asset_type for template access
    assets_dict = {}
    if template_assets:
        for a in template_assets:
            assets_dict[a.get("asset_type", "")] = a.get("file_url", "")

    try:
        rendered_html = template.render(
            **content_data,
            css_override=visual_css_override or "",
            assets=assets_dict,
        )
    except Exception as e:
        raise ValueError(
            f"Jinja2 template rendering failed for '{content_type}': {e}. "
            f"content_data keys: {list(content_data.keys())}"
        )

    # Ensure output directory exists
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)

    # Render with Playwright
    output_format = config["format"]
    ext = output_format
    output_path = RENDERS_DIR / f"{output_id}.{ext}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": config["width"], "height": config["height"]},
                device_scale_factor=2,  # 2x for retina quality
            )
            page.set_content(rendered_html, wait_until="networkidle")
            # Wait for fonts to load
            page.wait_for_timeout(500)

            if output_format == "pdf":
                # For carousel: each slide is a "page" in the HTML, render as PDF
                page.pdf(
                    path=str(output_path),
                    width=f"{config['width']}px",
                    height=f"{config['height']}px",
                    print_background=True,
                )
            else:
                # PNG: screenshot the full page
                page.screenshot(
                    path=str(output_path),
                    full_page=True,
                    type="png",
                )

            browser.close()
    except Exception as e:
        raise RuntimeError(
            f"Playwright browser rendering failed for '{content_type}': {e}"
        )

    return {
        "file_path": str(output_path),
        "file_name": f"{output_id}.{ext}",
        "rendered_html": rendered_html,
        "format": output_format,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render visual content asset")
    parser.add_argument("--content-type", required=True, choices=list(TEMPLATE_MAP.keys()))
    parser.add_argument("--content-data", required=True, help="JSON string with content fields")
    parser.add_argument("--output-id", default=None, help="Custom output ID (default: random UUID)")
    args = parser.parse_args()

    data = json.loads(args.content_data)
    result = render(
        content_type=args.content_type,
        content_data=data,
        content_id=args.output_id,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
