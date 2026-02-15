"""
Publish content to LinkedIn as a post via the LinkedIn API.

Requires a valid LinkedIn access token stored in org config.
"""
import httpx

LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


def publish_post(access_token: str, profile_sub: str, content_data: dict, language: str = "en") -> dict:
    """Publish a post to LinkedIn using the UGC Post API."""
    if not access_token:
        return {"id": "mock_linkedin", "url": "", "status": "mock"}

    # Build post text from content data
    title = content_data.get("title", "")
    body = content_data.get("body", "")
    hook = content_data.get("hook", "")
    cta = content_data.get("cta", "")
    hashtags = content_data.get("hashtags", [])

    text_parts = []
    if hook:
        text_parts.append(hook)
    elif title:
        text_parts.append(title)
    if body:
        text_parts.append(body)
    if cta:
        text_parts.append(cta)
    if hashtags:
        tags = " ".join(f"#{h}" if not h.startswith("#") else h for h in hashtags[:5])
        text_parts.append(tags)

    text = "\n\n".join(text_parts)
    if not text:
        text = title or "New post"

    # LinkedIn UGC Post API
    payload = {
        "author": f"urn:li:person:{profile_sub}",
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text[:3000]},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        },
    }

    resp = httpx.post(
        f"{LINKEDIN_API_BASE}/ugcPosts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    post_id = data.get("id", "")
    # LinkedIn post URL from the URN
    post_url = ""
    if post_id:
        # URN format: urn:li:share:12345
        numeric_id = post_id.split(":")[-1] if ":" in post_id else post_id
        post_url = f"https://www.linkedin.com/feed/update/{post_id}"

    return {
        "id": post_id,
        "url": post_url,
        "status": "published",
    }
