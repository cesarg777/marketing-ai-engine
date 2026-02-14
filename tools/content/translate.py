"""
Translate generated content while preserving structure, brand voice, and cultural context.
Uses Claude for context-aware translation (not a generic translation API).

Usage:
    python tools/content/translate.py \
        --input .tmp/content/carousel_42_en.json \
        --target-lang es \
        --target-country MX
"""
import argparse
import json

import anthropic

from tools.config import Config

TRANSLATION_SYSTEM = """You are a professional B2B content translator for Siete.

Rules:
1. Preserve the EXACT JSON structure — same keys, same nesting
2. Translate ALL text values to the target language
3. Adapt cultural references, idioms, and B2B terminology for the target country
4. Maintain Siete's professional but approachable brand voice
5. Do NOT translate keys that start with "_" (these are metadata)
6. SEO keywords should be localized, not literally translated
7. Keep proper nouns, brand names, and technical terms that don't have standard translations
8. Return ONLY valid JSON, no explanations"""


def translate(
    content_data: dict,
    source_language: str,
    target_language: str,
    target_country: str = "",
) -> dict:
    """Translate content data from one language to another using Claude."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_translate(content_data, target_language)

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    # Filter out metadata keys for translation
    translatable = {k: v for k, v in content_data.items() if not k.startswith("_")}

    user_prompt = f"""Translate the following content from **{source_language}** to **{target_language}**{f' (localized for {target_country})' if target_country else ''}.

Source content (JSON):
{json.dumps(translatable, indent=2, ensure_ascii=False)}

Return the translated content as a valid JSON object with the EXACT same structure."""

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=4096,
        system=TRANSLATION_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )

    response_text = response.content[0].text
    start = response_text.find("{")
    end = response_text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("Claude did not return valid translated JSON")

    translated = json.loads(response_text[start:end])

    # Restore metadata
    translated["_model"] = Config.ANTHROPIC_MODEL
    translated["_tokens"] = response.usage.input_tokens + response.usage.output_tokens
    translated["_source_language"] = source_language
    translated["_target_language"] = target_language

    return translated


def _mock_translate(content_data: dict, target_language: str) -> dict:
    """Return mock translation when no API key is configured."""
    translated = {}
    for k, v in content_data.items():
        if k.startswith("_"):
            translated[k] = v
        elif isinstance(v, str):
            translated[k] = f"[{target_language}] {v}"
        elif isinstance(v, list):
            translated[k] = [
                {kk: f"[{target_language}] {vv}" if isinstance(vv, str) else vv for kk, vv in item.items()}
                if isinstance(item, dict) else item
                for item in v
            ]
        else:
            translated[k] = v
    translated["_model"] = "mock"
    translated["_tokens"] = 0
    return translated


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--target-lang", required=True)
    parser.add_argument("--target-country", default="")
    args = parser.parse_args()

    with open(args.input) as f:
        data = json.load(f)

    result = translate(data, "en", args.target_lang, args.target_country)
    print(json.dumps(result, indent=2, ensure_ascii=False))
