"""Figma REST API wrapper for reading files, extracting text nodes, and exporting SVG."""
from __future__ import annotations

import logging
import requests

logger = logging.getLogger(__name__)

FIGMA_API = "https://api.figma.com/v1"
REQUEST_TIMEOUT = 30


def _headers(token: str) -> dict:
    return {"X-Figma-Token": token}


def validate_token(token: str) -> dict:
    """Validate a Figma Personal Access Token.

    Returns {"id": "...", "handle": "...", "email": "..."} on success.
    Raises requests.HTTPError on failure.
    """
    resp = requests.get(f"{FIGMA_API}/me", headers=_headers(token), timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def get_file_info(token: str, file_key: str) -> dict:
    """Get a Figma file's pages and top-level frames.

    Returns {name, pages: [{id, name, frames: [{id, name, type}]}]}
    """
    resp = requests.get(
        f"{FIGMA_API}/files/{file_key}",
        params={"depth": "2"},
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    pages = []
    for page in data.get("document", {}).get("children", []):
        frames = []
        for child in page.get("children", []):
            if child.get("type") in ("FRAME", "COMPONENT", "COMPONENT_SET"):
                frames.append({
                    "id": child["id"],
                    "name": child.get("name", ""),
                    "type": child["type"],
                })
        pages.append({
            "id": page["id"],
            "name": page.get("name", ""),
            "frames": frames,
        })

    return {
        "name": data.get("name", ""),
        "last_modified": data.get("lastModified", ""),
        "thumbnail_url": data.get("thumbnailUrl", ""),
        "pages": pages,
    }


def get_frame_text_nodes(token: str, file_key: str, node_id: str) -> list[dict]:
    """Extract all TEXT nodes from a specific frame.

    Returns list of {id, name, characters} for field mapping.
    """
    resp = requests.get(
        f"{FIGMA_API}/files/{file_key}/nodes",
        params={"ids": node_id},
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    nodes_data = resp.json().get("nodes", {})

    text_nodes: list[dict] = []

    def _walk(node: dict) -> None:
        if node.get("type") == "TEXT":
            text_nodes.append({
                "id": node["id"],
                "name": node.get("name", ""),
                "characters": node.get("characters", ""),
            })
        for child in node.get("children", []):
            _walk(child)

    for node_val in nodes_data.values():
        doc = node_val.get("document")
        if doc:
            _walk(doc)

    return text_nodes


def export_frame_svg(token: str, file_key: str, node_id: str) -> str:
    """Export a Figma frame as SVG with node IDs embedded.

    Returns the SVG download URL (valid ~30 days).
    """
    resp = requests.get(
        f"{FIGMA_API}/images/{file_key}",
        params={
            "ids": node_id,
            "format": "svg",
            "svg_include_id": "true",
        },
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    images = resp.json().get("images", {})
    url = images.get(node_id, "")
    if not url:
        raise ValueError(f"No SVG export URL returned for node {node_id}")
    return url


def export_frame_png(token: str, file_key: str, node_id: str, scale: float = 2.0) -> str:
    """Export a Figma frame as PNG at given scale.

    Returns the PNG download URL.
    """
    resp = requests.get(
        f"{FIGMA_API}/images/{file_key}",
        params={
            "ids": node_id,
            "format": "png",
            "scale": str(scale),
        },
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    images = resp.json().get("images", {})
    url = images.get(node_id, "")
    if not url:
        raise ValueError(f"No PNG export URL returned for node {node_id}")
    return url


def download_content(url: str) -> bytes:
    """Download content from a Figma CDN URL."""
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content
