from __future__ import annotations
"""
Core content generation tool using Claude API.
All specialized generators call this as their foundation.

Usage:
    python tools/content/generate_text.py \
        --topic "B2B lead generation challenges" \
        --template-type carousel \
        --language es
"""
import argparse
import json
import re

import anthropic

from tools.config import Config

BRAND_SYSTEM_PROMPT = """You are the content creation engine for Siete, a B2B company.

Your writing style is:
- Professional but approachable — never stiff or corporate-speak
- Data-driven with actionable insights that teams can implement immediately
- Clear and concise, no fluff or filler
- Adapted to the target language and cultural context (not just translated — localized)
- Engaging hooks that stop the scroll

Always maintain Siete's brand voice regardless of language or content type.
You MUST return ONLY a valid JSON object — no markdown, no code fences, no explanation."""


def _repair_json(raw: str) -> dict:
    """Best-effort repair of malformed JSON from Claude responses."""
    # Strip markdown code fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw.strip())
    raw = re.sub(r'\s*```$', '', raw.strip())

    # Extract outermost JSON object
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("No JSON object found in response")
    json_str = raw[start:end]

    # Attempt 1: parse as-is
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Attempt 2: fix trailing commas before } or ]
    cleaned = re.sub(r',\s*([}\]])', r'\1', json_str)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt 3: fix unescaped newlines inside string values
    # Replace literal newlines that are inside quotes with \\n
    fixed = re.sub(
        r'"([^"]*)"',
        lambda m: '"' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t') + '"',
        cleaned,
    )
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Attempt 4: fix unescaped control characters globally
    fixed2 = cleaned.encode('unicode_escape').decode('ascii')
    # Re-decode the escaped unicode back but keep control chars escaped
    # Actually, a simpler approach: just remove control chars except \n\r\t
    fixed3 = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned)
    try:
        return json.loads(fixed3)
    except json.JSONDecodeError as e:
        raise ValueError(f"Could not parse JSON after repair attempts: {e}")


def generate(
    template_structure: list[dict],
    template_system_prompt: str,
    topic: str,
    problem_context: dict | None = None,
    language: str = "en",
    country: str = "",
    tone: str = "professional",
    additional_instructions: str = "",
) -> dict:
    """Generate structured content using Claude API."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_content(template_structure, topic, language)

    client = anthropic.Anthropic(
        api_key=Config.ANTHROPIC_API_KEY,
        timeout=120.0,  # 2-minute timeout for content generation
    )

    # Build the system prompt
    system = BRAND_SYSTEM_PROMPT
    if template_system_prompt:
        system += f"\n\nTemplate-specific instructions:\n{template_system_prompt}"

    # Build the user prompt
    structure_desc = json.dumps(template_structure, indent=2)
    context_block = ""
    if problem_context:
        context_block = f"""
Research context:
- Problem: {problem_context.get('title', '')}
- Description: {problem_context.get('description', '')}
- Niche: {problem_context.get('niche', '')}
- Keywords: {', '.join(problem_context.get('keywords', []))}
- Suggested angles: {', '.join(problem_context.get('suggested_angles', []))}
"""

    user_prompt = f"""Generate content about: **{topic}**

Language: {language}
Country: {country or 'global'}
Tone: {tone}
{context_block}
{f'Additional instructions: {additional_instructions}' if additional_instructions else ''}

The content must follow this JSON structure (each field defined below):
{structure_desc}

Return a valid JSON object with all the required fields filled in.
Include a "title" field with a compelling title for this content piece.
IMPORTANT: Return ONLY the JSON object. No markdown fences. No explanation. Escape any newlines inside string values as \\n."""

    try:
        response = client.messages.create(
            model=Config.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system,
            messages=[
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": "{"},  # Prefill to force JSON
            ],
        )
    except anthropic.APITimeoutError:
        raise TimeoutError("Content generation timed out after 120 seconds. Please try again.")
    except anthropic.APIError as e:
        raise RuntimeError(f"Claude API error: {e}")

    # Prepend the "{" we used as prefill
    response_text = "{" + response.content[0].text

    content = _repair_json(response_text)

    # Add metadata
    content["_model"] = Config.ANTHROPIC_MODEL
    content["_tokens"] = response.usage.input_tokens + response.usage.output_tokens

    return content


def _mock_content(template_structure: list[dict], topic: str, language: str) -> dict:
    """Return mock content when no API key is configured."""
    content = {"title": f"[MOCK] {topic}"}
    for field in template_structure:
        name = field.get("name", "")
        field_type = field.get("type", "text")
        if field_type == "text":
            content[name] = f"[Mock {name} content about {topic}]"
        elif field_type == "textarea":
            content[name] = f"[Mock long-form {name} content about {topic}. This would be generated by Claude.]"
        elif field_type == "array":
            content[name] = [{"text": f"[Mock item {i+1}]"} for i in range(3)]
    content["_model"] = "mock"
    content["_tokens"] = 0
    return content


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", required=True)
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    # Simple test with minimal structure
    structure = [
        {"name": "title", "type": "text", "required": True},
        {"name": "body", "type": "textarea", "required": True},
        {"name": "cta", "type": "text", "required": True},
    ]
    result = generate(
        template_structure=structure,
        template_system_prompt="",
        topic=args.topic,
        language=args.language,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
