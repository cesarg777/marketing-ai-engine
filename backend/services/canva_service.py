"""Canva Connect API wrapper for OAuth 2.0, brand templates, and exports.

Uses Canva's REST API v1 with OAuth 2.0 + PKCE for authorization.
https://www.canva.dev/docs/connect/
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets
import time

import requests

logger = logging.getLogger(__name__)

CANVA_API = "https://api.canva.com/rest/v1"
CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize"
CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"
REQUEST_TIMEOUT = 30


def _auth_header(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


# ─── PKCE helpers ───

def generate_pkce() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge (S256).

    Returns (code_verifier, code_challenge).
    """
    code_verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


def build_auth_url(client_id: str, redirect_uri: str, state: str, code_challenge: str) -> str:
    """Build the Canva OAuth authorization URL with PKCE.

    Returns the URL the user should visit to authorize.
    """
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "scope": "asset:read asset:write design:content:read design:content:write design:meta:read brandtemplate:content:read brandtemplate:meta:read",
    }
    qs = "&".join(f"{k}={requests.utils.quote(v)}" for k, v in params.items())
    return f"{CANVA_AUTH_URL}?{qs}"


# ─── Token exchange ───

def exchange_code(
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    code_verifier: str,
) -> dict:
    """Exchange authorization code for access + refresh tokens.

    Returns {access_token, refresh_token, token_type, expires_in, scope}.
    """
    resp = requests.post(
        CANVA_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        },
        auth=(client_id, client_secret),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> dict:
    """Refresh an expired access token.

    Returns {access_token, refresh_token, token_type, expires_in, scope}.
    """
    resp = requests.post(
        CANVA_TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        auth=(client_id, client_secret),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def get_valid_token(config: dict) -> tuple[str, dict | None]:
    """Return a valid access token, refreshing if expired.

    Args:
        config: The stored canva_config dict from OrgConfig.
    Returns:
        (access_token, updated_config_or_None).
        If updated_config is not None, caller should persist it.
    """
    access_token = config.get("access_token", "")
    expires_at = config.get("expires_at", 0)

    # If not expired (with 60s buffer), return current token
    if access_token and time.time() < (expires_at - 60):
        return access_token, None

    # Need to refresh
    rt = config.get("refresh_token", "")
    if not rt:
        raise ValueError("No refresh token available; user must re-authorize Canva")

    client_id = os.getenv("CANVA_CLIENT_ID", "")
    client_secret = os.getenv("CANVA_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("CANVA_CLIENT_ID and CANVA_CLIENT_SECRET must be set")

    token_data = refresh_access_token(client_id, client_secret, rt)
    new_config = {
        **config,
        "access_token": token_data["access_token"],
        "refresh_token": token_data.get("refresh_token", rt),
        "expires_at": time.time() + token_data.get("expires_in", 3600),
    }
    return token_data["access_token"], new_config


# ─── User info ───

def get_user_info(access_token: str) -> dict:
    """Get the current Canva user profile.

    Returns {user_id, display_name, ...}.
    """
    resp = requests.get(
        f"{CANVA_API}/users/me",
        headers=_auth_header(access_token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("profile", resp.json())


# ─── Brand Templates ───

def list_brand_templates(access_token: str) -> list[dict]:
    """List available brand templates.

    Returns list of {id, title, thumbnail: {url, width, height}}.
    """
    templates = []
    continuation = None

    for _ in range(10):  # Max 10 pages
        params: dict = {"ownership": "owned"}
        if continuation:
            params["continuation"] = continuation

        resp = requests.get(
            f"{CANVA_API}/brand-templates",
            headers=_auth_header(access_token),
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            templates.append({
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "thumbnail": item.get("thumbnail", {}),
            })

        continuation = data.get("continuation")
        if not continuation:
            break

    return templates


def get_template_dataset(access_token: str, template_id: str) -> list[dict]:
    """Get the autofill dataset fields for a brand template.

    Returns list of {name, type} — the fillable fields.
    """
    resp = requests.get(
        f"{CANVA_API}/brand-templates/{template_id}/dataset",
        headers=_auth_header(access_token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    fields = []
    dataset = data.get("dataset", {})
    for name, info in dataset.items():
        fields.append({
            "name": name,
            "type": info.get("type", "text"),
        })
    return fields


# ─── Autofill + Export ───

def create_autofill(access_token: str, template_id: str, data_map: dict) -> dict:
    """Create an autofill job to populate a brand template.

    Args:
        data_map: {field_name: {type: "text", text: "..."} or {type: "image", asset_id: "..."}}
    Returns: {job: {id, status}} — use poll until status is "success".
    """
    resp = requests.post(
        f"{CANVA_API}/autofills",
        headers={
            **_auth_header(access_token),
            "Content-Type": "application/json",
        },
        json={
            "brand_template_id": template_id,
            "data": data_map,
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def get_autofill_job(access_token: str, job_id: str) -> dict:
    """Check autofill job status.

    Returns {job: {id, status, result: {design: {id, ...}}}} when complete.
    """
    resp = requests.get(
        f"{CANVA_API}/autofills/{job_id}",
        headers=_auth_header(access_token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def wait_for_autofill(access_token: str, job_id: str, max_wait: int = 60) -> dict:
    """Poll autofill job until completion or timeout.

    Returns the final job status dict.
    Raises TimeoutError if not completed within max_wait seconds.
    """
    start = time.time()
    delay = 1.0
    while time.time() - start < max_wait:
        result = get_autofill_job(access_token, job_id)
        status = result.get("job", {}).get("status", "")
        if status == "success":
            return result
        if status == "failed":
            raise RuntimeError(f"Autofill job failed: {result}")
        time.sleep(delay)
        delay = min(delay * 1.5, 5.0)  # Exponential backoff, max 5s

    raise TimeoutError(f"Autofill job {job_id} did not complete within {max_wait}s")


def create_export(access_token: str, design_id: str, fmt: str = "png") -> dict:
    """Start an export job for a Canva design.

    Args:
        fmt: "png", "pdf", or "jpg"
    Returns: {job: {id, status}}
    """
    export_type = "png" if fmt == "png" else "pdf" if fmt == "pdf" else "jpg"
    resp = requests.post(
        f"{CANVA_API}/exports",
        headers={
            **_auth_header(access_token),
            "Content-Type": "application/json",
        },
        json={
            "design_id": design_id,
            "format": {"type": export_type},
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def get_export_job(access_token: str, export_id: str) -> dict:
    """Check export job status.

    Returns {job: {id, status, urls: [...]}} when complete.
    """
    resp = requests.get(
        f"{CANVA_API}/exports/{export_id}",
        headers=_auth_header(access_token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def wait_for_export(access_token: str, export_id: str, max_wait: int = 60) -> list[str]:
    """Poll export job until completion, return download URLs.

    Returns list of download URLs (usually one).
    Raises TimeoutError if not completed within max_wait seconds.
    """
    start = time.time()
    delay = 1.0
    while time.time() - start < max_wait:
        result = get_export_job(access_token, export_id)
        status = result.get("job", {}).get("status", "")
        if status == "success":
            return result.get("job", {}).get("urls", [])
        if status == "failed":
            raise RuntimeError(f"Export job failed: {result}")
        time.sleep(delay)
        delay = min(delay * 1.5, 5.0)

    raise TimeoutError(f"Export job {export_id} did not complete within {max_wait}s")


def download_file(url: str) -> bytes:
    """Download exported file from Canva CDN URL."""
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content
