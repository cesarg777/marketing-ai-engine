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

# ---------------------------------------------------------------------------
# Field alias maps per visual type
# Each entry: expected_field_name -> set of aliases (Spanish + English variants)
# ---------------------------------------------------------------------------
_METADATA_FIELDS = {"_model", "_tokens"}

_FIELD_ALIASES = {
    "carousel": {
        "title": set(),
        "cta": {"cierre", "closing", "cta_text", "call_to_action"},
        "social_caption": {"copylinkedin", "copy_linkedin", "linkedin_caption", "caption", "descripcion"},
        "social_hashtags": {"hashtags"},
    },
    "meet_the_team": {
        "title": set(),
        "person_name": {"nombre", "name", "nombre_persona"},
        "role": {"cargo", "puesto", "titulo", "position"},
        "quote": {"cita", "frase", "testimonio"},
        "bio": {"biografia", "about", "descripcion"},
        "fun_fact": {"dato_curioso", "curiosidad"},
        "photo_url": {"foto", "imagen", "photo"},
        "social_caption": {"copylinkedin", "copy_linkedin", "caption"},
        "social_hashtags": {"hashtags"},
    },
    "meme": {
        "title": set(),
        "top_text": {"texto_superior", "texto_arriba", "text_top", "setup"},
        "bottom_text": {"texto_inferior", "texto_abajo", "text_bottom", "punchline", "remate"},
        "image_prompt": {"prompt_imagen", "imagen", "image"},
        "context": {"contexto", "explicacion"},
        "social_caption": {"copylinkedin", "copy_linkedin", "caption"},
        "social_hashtags": {"hashtags"},
    },
    "case_study": {
        "title": set(),
        "client": {"cliente", "empresa", "company"},
        "challenge": {"problema", "desafio", "reto", "pain_point"},
        "solution": {"solucion", "estrategia", "approach"},
        "results": {"resultados", "impacto", "impact"},
        "industry": {"industria", "sector", "vertical"},
        "testimonial": {"testimonio", "quote", "cita"},
        "social_caption": {"copylinkedin", "copy_linkedin", "caption"},
        "social_hashtags": {"hashtags"},
    },
    "infografia": {
        "title": set(),
        "social_caption": {"copylinkedin", "copy_linkedin", "caption"},
        "social_hashtags": {"hashtags"},
    },
}

# Visual types that use an array field built from flat content fields
_ARRAY_FIELD_TYPES = {
    "carousel": "slides",       # [{headline, body}]
    "infografia": "slides",     # [{headline, body}]
    "case_study": "key_metrics", # [{metric, value}]
}


def _resolve_field(data: dict, field: str, aliases: set) -> str:
    """Find a field value by checking the canonical name first, then aliases."""
    if field in data and data[field]:
        return data[field]
    for alias in aliases:
        if alias in data and data[alias]:
            return data[alias]
    return ""


def _normalize_visual_data(content_type: str, data: dict) -> dict:
    """Normalize content_data so it matches what the HTML template expects.

    For each visual type:
    1. Maps field aliases (Spanish/custom names → canonical names)
    2. Builds array fields (slides[], key_metrics[]) from flat custom fields
    3. Preserves metadata (_model, _tokens)
    """
    aliases_map = _FIELD_ALIASES.get(content_type)
    if not aliases_map:
        return data  # Unknown type, pass through

    # If the template has an array field and it already exists, use data as-is
    array_field = _ARRAY_FIELD_TYPES.get(content_type)
    if array_field and isinstance(data.get(array_field), list) and data[array_field]:
        # Still resolve aliases for non-array fields
        normalized = dict(data)
        for field, field_aliases in aliases_map.items():
            if field not in normalized or not normalized[field]:
                resolved = _resolve_field(data, field, field_aliases)
                if resolved:
                    normalized[field] = resolved
        return normalized

    # Build normalized dict from alias resolution
    normalized = {}
    mapped_source_keys = set()  # Track which source keys were consumed by alias mapping

    for field, field_aliases in aliases_map.items():
        resolved = _resolve_field(data, field, field_aliases)
        normalized[field] = resolved
        # Track which keys were consumed
        if resolved:
            if field in data:
                mapped_source_keys.add(field)
            for alias in field_aliases:
                if alias in data and data[alias] == resolved:
                    mapped_source_keys.add(alias)
                    break

    # Build array field from remaining flat text fields
    if array_field:
        skip = set(aliases_map.keys()) | _METADATA_FIELDS
        for field_aliases in aliases_map.values():
            skip |= field_aliases
        skip |= mapped_source_keys

        items = []
        for key, value in data.items():
            if key in skip or key.startswith("_") or not value or not isinstance(value, str):
                continue
            headline = key.replace("_", " ").replace("-", " ").title()
            if content_type == "case_study":
                items.append({"metric": headline, "value": value})
            else:
                items.append({"headline": headline, "body": value})
        normalized[array_field] = items

    # Preserve metadata
    for meta in _METADATA_FIELDS:
        if meta in data:
            normalized[meta] = data[meta]

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

    # Normalize visual data: map field aliases + build arrays from flat fields
    if content_type in _FIELD_ALIASES:
        content_data = _normalize_visual_data(content_type, content_data)

    # Validate array fields exist for types that need them
    array_field = _ARRAY_FIELD_TYPES.get(content_type)
    if array_field and not content_data.get(array_field):
        raise ValueError(
            f"'{content_type}' has no renderable '{array_field}'. "
            f"Got keys: {list(content_data.keys())}"
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
