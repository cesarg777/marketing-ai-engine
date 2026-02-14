"""
Expand short-form content into a full SEO-optimized blog post using Claude.

Usage:
    python tools/amplification/create_blog_post.py --content-id 42
"""
import json

import anthropic

from tools.config import Config

BLOG_SYSTEM = """You are a B2B content writer for Siete.
Expand the provided short-form content into a comprehensive blog post (1500-2500 words).

Requirements:
- SEO-optimized title (under 60 chars) and meta_description (under 160 chars)
- Proper heading hierarchy: H2 for main sections, H3 for subsections
- Engaging introduction with a hook
- 3-5 main sections with actionable insights
- Data points, examples, or statistics where relevant
- Strong conclusion with a clear CTA
- Maintain Siete's professional but approachable voice

Return JSON with: title, meta_description, sections (array of {heading, body}), conclusion, cta"""


def expand_to_blog(
    source_content: dict,
    source_type: str,
    language: str = "en",
    tone: str = "professional",
) -> dict:
    """Expand short-form content into a blog post."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_blog(source_content, language)

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    # Filter out metadata
    content_str = json.dumps(
        {k: v for k, v in source_content.items() if not k.startswith("_")},
        ensure_ascii=False,
    )

    user_prompt = f"""Expand this {source_type} content into a full blog post.

Language: {language}
Tone: {tone}

Source content:
{content_str}

Return a valid JSON object with: title, meta_description, sections (array of objects with heading and body), conclusion, cta"""

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=6000,
        system=BLOG_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = response.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    blog = json.loads(text[start:end])
    blog["_model"] = Config.ANTHROPIC_MODEL
    blog["_tokens"] = response.usage.input_tokens + response.usage.output_tokens
    return blog


def _mock_blog(source_content: dict, language: str) -> dict:
    title = source_content.get("title", "Blog Post")
    return {
        "title": f"[MOCK Blog] {title}",
        "meta_description": f"A comprehensive guide about {title}",
        "sections": [
            {"heading": "Introduction", "body": f"[Mock intro about {title}]"},
            {"heading": "The Challenge", "body": "[Mock section 1]"},
            {"heading": "The Solution", "body": "[Mock section 2]"},
        ],
        "conclusion": "[Mock conclusion]",
        "cta": "Contact Siete to learn more.",
        "_model": "mock",
        "_tokens": 0,
    }
