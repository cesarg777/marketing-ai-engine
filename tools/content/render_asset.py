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

    rendered_html = template.render(
        **content_data,
        css_override=visual_css_override or "",
    )

    # Ensure output directory exists
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)

    # Render with Playwright
    output_format = config["format"]
    ext = output_format
    output_path = RENDERS_DIR / f"{output_id}.{ext}"

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
