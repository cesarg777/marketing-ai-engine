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
import base64
import html as _html
import json
import mimetypes
import re as _re
import uuid
import xml.etree.ElementTree as ET
import defusedxml.ElementTree as SafeET
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


# ---------------------------------------------------------------------------
# Design template asset types for overlay mode
# ---------------------------------------------------------------------------
_DESIGN_ASSET_TYPES = {
    "design_background",  # Single-page templates (meet_the_team, meme, etc.)
    "design_cover",       # Carousel cover slide
    "design_slide",       # Carousel content slide (reused per slide)
    "design_cta",         # Carousel CTA slide
}


def _resolve_image_url(url: str) -> str:
    """Convert file:// URLs to data URIs for Playwright compatibility.

    HTTPS URLs pass through unchanged (work in production with Supabase Storage).
    Local file:// URLs are embedded as base64 data URIs.
    """
    if not url:
        return url
    if url.startswith("file://"):
        file_path = url.replace("file://", "")
        p = Path(file_path)
        if p.exists():
            mime = mimetypes.guess_type(file_path)[0] or "image/png"
            data = base64.b64encode(p.read_bytes()).decode("ascii")
            return f"data:{mime};base64,{data}"
    return url


def _get_design_assets(template_assets: list[dict] | None, content_type: str) -> dict:
    """Check if template has uploaded design backgrounds for overlay mode.

    Returns dict mapping asset_type -> file_url, or empty dict if no designs found.
    """
    if not template_assets:
        return {}
    designs = {}
    for a in template_assets:
        atype = a.get("asset_type", "")
        if atype in _DESIGN_ASSET_TYPES and a.get("file_url"):
            designs[atype] = a["file_url"]

    # For single-page templates, need design_background
    if content_type != "carousel" and "design_background" in designs:
        return designs
    # For carousel, need at least design_slide
    if content_type == "carousel" and "design_slide" in designs:
        return designs
    return {}


def _render_overlay_html(
    content_type: str,
    content_data: dict,
    design_assets: dict,
    zones: dict,
    config: dict,
    brand: dict,
) -> str:
    """Build HTML with design image as background + positioned text overlays.

    For each text zone:
      1. If zone has bg_fill -> draw a filled rect to cover original text
      2. Draw the new text at the zone position with specified styling
    """
    width = config["width"]
    height = config["height"]

    def _zone_html(text: str, zone: dict) -> str:
        """Generate HTML divs for a single text zone (cover + text).

        The bg_fill rectangle can optionally use separate dimensions
        (bg_x, bg_y, bg_width, bg_height) to cover a larger area than
        the text zone — useful when original design text extends beyond
        where new text will be placed.
        """
        if not text or not zone:
            return ""
        x = zone.get("x", 0)
        y = zone.get("y", 0)
        w = zone.get("width", 400)
        h = zone.get("height", 100)
        font_size = zone.get("font_size", 20)
        font_weight = zone.get("font_weight", 400)
        font_family = zone.get("font_family", "Inter, sans-serif")
        color = zone.get("color", "#000000")
        align = zone.get("align", "left")
        line_height = zone.get("line_height", 1.4)
        text_transform = zone.get("text_transform", "none")
        bg_fill = zone.get("bg_fill", "")
        padding = zone.get("padding", 0)

        # bg_fill rect can use separate dimensions to cover larger area
        bg_x = zone.get("bg_x", x)
        bg_y = zone.get("bg_y", y)
        bg_w = zone.get("bg_width", w)
        bg_h = zone.get("bg_height", h)

        parts = []
        # Cover rect to hide original text
        if bg_fill and bg_fill != "transparent":
            parts.append(
                f'<div style="position:absolute;top:{bg_y}px;left:{bg_x}px;'
                f'width:{bg_w}px;height:{bg_h}px;background:{bg_fill};z-index:1;"></div>'
            )
        # Text overlay
        parts.append(
            f'<div style="position:absolute;top:{y}px;left:{x}px;'
            f"width:{w}px;height:{h}px;"
            f"font-size:{font_size}px;font-weight:{font_weight};"
            f"font-family:'{font_family}',sans-serif;color:{color};"
            f"text-align:{align};line-height:{line_height};"
            f"text-transform:{text_transform};padding:{padding}px;"
            f'overflow:hidden;z-index:2;display:flex;align-items:flex-start;">'
            f"<span>{_html.escape(str(text))}</span></div>"
        )
        return "\n".join(parts)

    font_link = (
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900'
        '&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">'
    )

    if content_type == "carousel":
        # Multi-page: cover + N content slides + CTA
        pages = []
        cover_bg = _resolve_image_url(design_assets.get("design_cover", design_assets.get("design_slide", "")))
        slide_bg = _resolve_image_url(design_assets.get("design_slide", ""))
        cta_bg = _resolve_image_url(design_assets.get("design_cta", design_assets.get("design_slide", "")))
        slides = content_data.get("slides", [])

        # Cover page
        cover_zones = ""
        for field_name in ("title", "social_caption"):
            if field_name in zones and content_data.get(field_name):
                cover_zones += _zone_html(str(content_data[field_name]), zones[field_name])
        pages.append(
            f'<div class="page" style="background-image:url(\'{cover_bg}\');">{cover_zones}</div>'
        )

        # Content slides
        slide_headline_zone = zones.get("slide_headline", {})
        slide_body_zone = zones.get("slide_body", {})
        for slide in slides:
            slide_zones = ""
            if slide_headline_zone and slide.get("headline"):
                slide_zones += _zone_html(str(slide["headline"]), slide_headline_zone)
            if slide_body_zone and slide.get("body"):
                slide_zones += _zone_html(str(slide["body"]), slide_body_zone)
            pages.append(
                f'<div class="page" style="background-image:url(\'{slide_bg}\');">{slide_zones}</div>'
            )

        # CTA page
        cta_zones = ""
        if "cta" in zones and content_data.get("cta"):
            cta_zones += _zone_html(str(content_data["cta"]), zones["cta"])
        pages.append(
            f'<div class="page" style="background-image:url(\'{cta_bg}\');">{cta_zones}</div>'
        )

        pages_html = "\n".join(pages)
        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">{font_link}
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:{width}px;font-family:'Inter',sans-serif;}}
.page{{width:{width}px;height:{height}px;position:relative;overflow:hidden;
background-size:cover;background-position:center;background-repeat:no-repeat;
page-break-after:always;}}
.page:last-child{{page-break-after:auto;}}
</style></head>
<body>{pages_html}</body></html>"""

    else:
        # Single-page template
        bg_url = _resolve_image_url(design_assets.get("design_background", ""))
        zone_html_parts = []
        for field_name, zone in zones.items():
            text_value = content_data.get(field_name, "")
            if isinstance(text_value, str) and text_value:
                zone_html_parts.append(_zone_html(text_value, zone))
            elif isinstance(text_value, list):
                # Array fields like key_metrics — join as text
                for item in text_value:
                    if isinstance(item, dict):
                        text = " — ".join(str(v) for v in item.values())
                        zone_html_parts.append(_zone_html(text, zone))

        zones_html = "\n".join(zone_html_parts)
        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">{font_link}
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:{width}px;height:{height}px;font-family:'Inter',sans-serif;
position:relative;overflow:hidden;
background-image:url('{bg_url}');background-size:cover;background-position:center;
background-repeat:no-repeat;}}
</style></head>
<body>{zones_html}</body></html>"""


# ---------------------------------------------------------------------------
# SVG template mode: Edit text directly in editable SVG files
# ---------------------------------------------------------------------------
_SVG_ASSET_TYPES = {
    "design_svg",        # Single-page SVG template
    "design_svg_cover",  # Carousel cover SVG
    "design_svg_slide",  # Carousel content slide SVG
    "design_svg_cta",    # Carousel CTA SVG
}


def _get_svg_assets(template_assets: list[dict] | None, content_type: str) -> dict:
    """Check if template has SVG template assets for direct text editing.

    Returns dict mapping asset_type -> file_url, or empty dict.
    """
    if not template_assets:
        return {}
    svgs = {}
    for a in template_assets:
        atype = a.get("asset_type", "")
        if atype in _SVG_ASSET_TYPES and a.get("file_url"):
            svgs[atype] = a["file_url"]

    if content_type != "carousel" and "design_svg" in svgs:
        return svgs
    if content_type == "carousel" and "design_svg_slide" in svgs:
        return svgs
    return {}


def _load_svg_content(url: str) -> str:
    """Load SVG content from a URL or file path.

    Security: local file access is restricted to TEMPLATES_DIR and TMP_DIR.
    """
    if url.startswith("file://"):
        path = Path(url.replace("file://", "")).resolve()
        _validate_local_path(path)
        return path.read_text(encoding="utf-8")
    elif url.startswith("http"):
        import urllib.request
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = resp.read(10 * 1024 * 1024)  # 10 MB limit
            return data.decode("utf-8")
    else:
        path = Path(url).resolve()
        _validate_local_path(path)
        return path.read_text(encoding="utf-8")


# Allowed directories for local file reads
_ALLOWED_DIRS = [TEMPLATES_DIR.resolve(), RENDERS_DIR.resolve(), Config.TMP_DIR.resolve()]


def _validate_local_path(path: Path) -> None:
    """Ensure a resolved path is within allowed directories."""
    for allowed in _ALLOWED_DIRS:
        if str(path).startswith(str(allowed)):
            return
    raise PermissionError(f"Access denied: {path} is outside allowed directories")


def _replace_svg_text(svg_content: str, replacements: dict) -> str:
    """Replace text content in SVG by matching layer/element IDs or data attributes.

    Figma exports SVG with id attributes based on layer names. This function
    finds text elements whose id contains the field name and replaces their text.

    Supports two matching strategies:
      1. id attribute: <text id="person_name">Old Text</text>
      2. data-field attribute: <text data-field="person_name">Old Text</text>

    For multi-line text (tspan elements), replaces all tspan content.
    """
    # Parse SVG as XML
    # Register SVG namespace to preserve it in output
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    root = SafeET.fromstring(svg_content)
    ns = {"svg": "http://www.w3.org/2000/svg"}

    def _find_text_elements(element, field_name):
        """Find text elements matching a field name by id or data-field."""
        matches = []
        # Check id attribute
        elem_id = element.get("id", "")
        data_field = element.get("data-field", "")
        if field_name in elem_id.lower() or field_name == data_field:
            if element.tag.endswith("}text") or element.tag == "text":
                matches.append(element)
        # Recurse into children
        for child in element:
            matches.extend(_find_text_elements(child, field_name))
        return matches

    for field_name, new_text in replacements.items():
        if not new_text:
            continue
        elements = _find_text_elements(root, field_name.lower())
        for elem in elements:
            # Check if element has tspan children
            tspans = list(elem.iter("{http://www.w3.org/2000/svg}tspan"))
            if not tspans:
                tspans = list(elem.iter("tspan"))

            if tspans:
                # Replace first tspan, clear the rest
                # For multi-line: split text into lines matching tspan count
                lines = new_text.split("\n") if "\n" in new_text else [new_text]
                for i, tspan in enumerate(tspans):
                    if i < len(lines):
                        tspan.text = lines[i]
                    else:
                        tspan.text = ""
            else:
                elem.text = new_text

    return ET.tostring(root, encoding="unicode", xml_declaration=False)


def _render_svg_template(
    content_type: str,
    content_data: dict,
    svg_assets: dict,
    config: dict,
    brand: dict,
) -> str:
    """Render by editing text in SVG templates, then wrapping in HTML for Playwright.

    For single-page types: Load SVG, replace text, wrap in HTML.
    For carousel: Load each page SVG, replace text, combine as multi-page HTML.
    """
    width = config["width"]
    height = config["height"]

    def _build_replacements(data: dict, extra: dict | None = None) -> dict:
        """Build field_name -> text_value map for SVG replacement."""
        replacements = {}
        for key, value in data.items():
            if isinstance(value, str):
                replacements[key] = value
        # Add brand fields
        replacements["brand_name"] = brand.get("name", "")
        replacements["brand_website"] = brand.get("website", "")
        if extra:
            replacements.update(extra)
        return replacements

    if content_type == "carousel":
        pages_html = []
        slides = content_data.get("slides", [])

        # Cover page
        cover_url = svg_assets.get("design_svg_cover", svg_assets.get("design_svg_slide", ""))
        if cover_url:
            svg = _load_svg_content(cover_url)
            replacements = _build_replacements(content_data)
            modified_svg = _replace_svg_text(svg, replacements)
            pages_html.append(
                f'<div class="page">{modified_svg}</div>'
            )

        # Content slides
        slide_url = svg_assets.get("design_svg_slide", "")
        if slide_url:
            slide_svg = _load_svg_content(slide_url)
            for slide in slides:
                replacements = _build_replacements(slide)
                modified = _replace_svg_text(slide_svg, replacements)
                pages_html.append(
                    f'<div class="page">{modified}</div>'
                )

        # CTA page
        cta_url = svg_assets.get("design_svg_cta", svg_assets.get("design_svg_slide", ""))
        if cta_url:
            svg = _load_svg_content(cta_url)
            replacements = _build_replacements(content_data)
            modified = _replace_svg_text(svg, replacements)
            pages_html.append(
                f'<div class="page">{modified}</div>'
            )

        all_pages = "\n".join(pages_html)
        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:{width}px;}}
.page{{width:{width}px;height:{height}px;overflow:hidden;page-break-after:always;}}
.page:last-child{{page-break-after:auto;}}
.page svg{{width:100%;height:100%;}}
</style></head>
<body>{all_pages}</body></html>"""

    else:
        # Single-page: load SVG, replace text, wrap in HTML
        svg_url = svg_assets.get("design_svg", "")
        svg = _load_svg_content(svg_url)
        replacements = _build_replacements(content_data)
        modified_svg = _replace_svg_text(svg, replacements)

        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:{width}px;height:{height}px;overflow:hidden;}}
svg{{width:100%;height:100%;}}
</style></head>
<body>{modified_svg}</body></html>"""


def generate_html(
    content_type: str,
    content_data: dict,
    visual_layout_override: str | None = None,
    visual_css_override: str | None = None,
    template_assets: list[dict] | None = None,
    brand_context: dict | None = None,
    structure_zones: dict | None = None,
) -> str:
    """Generate rendered HTML without Playwright. Returns HTML string.

    Same four rendering modes as render(), but stops before the browser step.
    Useful for preview flows where the user can edit before final render.
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

    # Build assets dict keyed by asset_type for template access
    assets_dict = {}
    if template_assets:
        for a in template_assets:
            assets_dict[a.get("asset_type", "")] = a.get("file_url", "")

    # Build brand dict with defaults for templates
    brand = {
        "name": "",
        "logo_url": "",
        "website": "",
        "accent_color": "#0066FF",
    }
    if brand_context:
        brand.update({k: v for k, v in brand_context.items() if v})

    # --- MODE 0: SVG TEMPLATE (edit text in SVG source) ---
    svg_assets = _get_svg_assets(template_assets, content_type)
    if svg_assets:
        return _render_svg_template(
            content_type, content_data, svg_assets, config, brand,
        )
    # --- MODE 1: OVERLAY (design background + text zones) ---
    if (design_assets := _get_design_assets(template_assets, content_type)) and structure_zones:
        return _render_overlay_html(
            content_type, content_data, design_assets,
            structure_zones, config, brand,
        )
    # --- MODE 2: CUSTOM HTML or MODE 3: DEFAULT FILE ---
    if visual_layout_override:
        env = Environment(autoescape=True)
        template = env.from_string(visual_layout_override)
    else:
        env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=True,
        )
        template = env.get_template(config["file"])

    try:
        return template.render(
            **content_data,
            css_override=visual_css_override or "",
            assets=assets_dict,
            brand=brand,
        )
    except Exception as e:
        raise ValueError(
            f"Jinja2 template rendering failed for '{content_type}': {e}. "
            f"content_data keys: {list(content_data.keys())}"
        )


def _render_html_with_playwright(
    html: str,
    content_type: str,
    output_id: str,
) -> dict:
    """Take HTML and render to PNG/PDF via Playwright.

    Returns dict with file_path, file_name, rendered_html, format.
    """
    config = TEMPLATE_MAP[content_type]
    output_format = config["format"]
    ext = output_format

    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RENDERS_DIR / f"{output_id}.{ext}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": config["width"], "height": config["height"]},
                device_scale_factor=2,  # 2x for retina quality
            )
            page.set_content(html, wait_until="networkidle")
            # Wait for fonts to load
            page.wait_for_timeout(500)

            if output_format == "pdf":
                page.pdf(
                    path=str(output_path),
                    width=f"{config['width']}px",
                    height=f"{config['height']}px",
                    print_background=True,
                )
            else:
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
        "rendered_html": html,
        "format": output_format,
    }


def render_from_html(
    html: str,
    content_type: str,
    content_id: str | None = None,
) -> dict:
    """Take pre-built HTML and render to PNG/PDF via Playwright.

    Used by the editable preview flow where the user may have edited the HTML.
    """
    if content_type not in TEMPLATE_MAP:
        raise ValueError(f"Unknown visual content type: {content_type}. Supported: {list(TEMPLATE_MAP.keys())}")
    output_id = content_id or str(uuid.uuid4())
    return _render_html_with_playwright(html, content_type, output_id)


def render(
    content_type: str,
    content_data: dict,
    content_id: str | None = None,
    visual_layout_override: str | None = None,
    visual_css_override: str | None = None,
    template_assets: list[dict] | None = None,
    brand_context: dict | None = None,
    structure_zones: dict | None = None,
) -> dict:
    """Render content_data into a visual asset (PNG or PDF).

    Four rendering modes (checked in order):
      1. SVG TEMPLATE MODE: If template has design_svg assets, edit text directly
         in the SVG source and render. Cleanest results — preserves exact design.
      2. OVERLAY MODE: If template has design_background assets + text zones,
         use the uploaded design as background and overlay text at defined positions.
      3. CUSTOM HTML MODE: If visual_layout_override is provided, use it as Jinja2.
      4. DEFAULT HTML MODE: Fall back to file-based Jinja2 template.

    Args:
        content_type: One of VISUAL_TYPES (e.g. "carousel", "meet_the_team")
        content_data: Dict with all content fields from generation
        content_id: Optional ID for output filename (auto-generated if None)
        visual_layout_override: Optional custom HTML template (overrides file)
        visual_css_override: Optional custom CSS (injected into template)
        template_assets: Optional list of template asset dicts (asset_type, file_url)
        brand_context: Optional dict with org brand info (name, logo_url, website, accent_color)
        structure_zones: Optional dict mapping field_name -> zone config for overlay mode

    Returns:
        dict with keys: file_path, rendered_html, format
    """
    rendered_html = generate_html(
        content_type=content_type,
        content_data=content_data,
        visual_layout_override=visual_layout_override,
        visual_css_override=visual_css_override,
        template_assets=template_assets,
        brand_context=brand_context,
        structure_zones=structure_zones,
    )

    output_id = content_id or str(uuid.uuid4())
    return _render_html_with_playwright(rendered_html, content_type, output_id)


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
