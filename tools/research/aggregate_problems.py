from __future__ import annotations
"""
Aggregate raw research data into top 10 B2B problems per niche.
Uses Claude to analyze, deduplicate, rank, and classify.

Usage:
    python tools/research/aggregate_problems.py --niche marketing --country US

Input:
    Reads raw data passed as argument or from .tmp/research/*.json

Output:
    List of structured problem dicts ready for database insertion.
"""
import argparse
import json
from datetime import date

import anthropic

from tools.config import Config

SYSTEM_PROMPT = """You are a B2B market research analyst for Siete.
Analyze the provided raw data from multiple sources (Google Trends, Reddit,
LinkedIn, news, blogs) and identify the top 10 most pressing B2B problems
for the specified niche and country.

For each problem, return a JSON object with these fields:
- problem_title: Clear, concise title (max 80 chars)
- problem_description: 2-3 sentence description of the problem
- severity: 1-10 scale (10 = most severe)
- trending_direction: "rising", "stable", or "declining"
- related_niches: list of other niches affected
- source_count: how many independent sources mention this
- source_urls: list of source URLs that reference this problem
- suggested_angles: 3 content marketing angles to address this problem
- keywords: 5-8 SEO-relevant keywords
- language_variants: object with problem_title translated to {"es": "...", "en": "...", "pt": "..."}

Return a JSON array of exactly 10 problems, ordered by severity (highest first).
Only include problems mentioned by at least 2 independent sources.
If fewer than 10 problems meet the threshold, return as many as qualify."""


def aggregate(
    raw_data: list[dict],
    niche: str,
    country: str,
    decision_makers: list[str] | None = None,
    keywords: list[str] | None = None,
) -> list[dict]:
    """Use Claude to analyze raw data and extract top 10 problems."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_problems(niche, country)

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    # Truncate raw data to fit context window
    data_str = json.dumps(raw_data, ensure_ascii=False)
    if len(data_str) > 80000:
        data_str = data_str[:80000] + "\n... [truncated]"

    # Build context for decision makers and keywords
    extra_context = ""
    if decision_makers:
        dm_list = ", ".join(decision_makers)
        extra_context += f"\n\nTarget decision makers: {dm_list}. Focus on problems that these roles care about and would invest budget to solve."
    if keywords:
        kw_list = ", ".join(keywords)
        extra_context += f"\n\nPriority keywords/topics: {kw_list}. Prioritize problems related to these terms."

    user_prompt = f"""Analyze the following raw research data for the **{niche}** niche in **{country}**.{extra_context}

Raw data from multiple sources:
{data_str}

Identify the top 10 B2B sales problems for this niche and country. Return ONLY valid JSON."""

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL_RESEARCH,
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    # Parse the response
    response_text = response.content[0].text
    # Find JSON array in response
    start = response_text.find("[")
    end = response_text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError("Claude did not return a valid JSON array")

    problems = json.loads(response_text[start:end])
    return problems


def _mock_problems(niche: str, country: str) -> list[dict]:
    """Return mock problems when no API key is configured."""
    return [
        {
            "problem_title": f"Difficulty measuring {niche} ROI in B2B",
            "problem_description": f"B2B {niche} teams struggle to demonstrate clear ROI to leadership, leading to budget cuts and reduced headcount.",
            "severity": 9,
            "trending_direction": "rising",
            "related_niches": ["sales", "finance"],
            "source_count": 5,
            "source_urls": ["https://example.com/1", "https://example.com/2"],
            "suggested_angles": [
                f"How to build a {niche} ROI dashboard in 30 minutes",
                f"5 metrics every B2B {niche} team should track",
                f"Why most {niche} ROI calculations are wrong",
            ],
            "keywords": [f"B2B {niche} ROI", f"{niche} metrics", "B2B analytics"],
            "language_variants": {
                "en": f"Difficulty measuring {niche} ROI in B2B",
                "es": f"Dificultad para medir el ROI de {niche} en B2B",
                "pt": f"Dificuldade em medir o ROI de {niche} em B2B",
            },
        }
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", required=True)
    parser.add_argument("--country", required=True)
    args = parser.parse_args()

    # Load all raw data from .tmp
    tmp_dir = Config.TMP_DIR / "research"
    raw_data = []
    if tmp_dir.exists():
        for f in tmp_dir.glob(f"*_{args.niche}_{args.country}_*.json"):
            raw_data.extend(json.loads(f.read_text()))

    if not raw_data:
        print("No raw data found. Run scrapers first.")
    else:
        problems = aggregate(raw_data, args.niche, args.country)
        print(json.dumps(problems, indent=2, ensure_ascii=False))
