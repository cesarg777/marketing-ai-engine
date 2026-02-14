"""
AI-powered performance evaluation using Claude.
Analyzes weekly content metrics and generates insights + recommendations.

Usage:
    python tools/tracking/evaluate_performance.py --week 2026-02-09
"""
import json

import anthropic

from tools.config import Config

EVAL_SYSTEM = """You are a B2B content performance analyst for Siete.
Analyze the provided weekly content metrics and generate:

1. **insights**: A paragraph summarizing key patterns (which content types, topics, languages performed best and why)
2. **recommendations**: Array of {action, priority (high/medium/low), reasoning} for next week's content strategy

Be specific and actionable. Reference actual content titles and numbers.
Return valid JSON with: insights (string), recommendations (array)."""


def evaluate(metrics_summary: list[dict]) -> dict:
    """Evaluate content performance and generate AI insights."""
    if not Config.ANTHROPIC_API_KEY:
        return _mock_evaluation(metrics_summary)

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    metrics_str = json.dumps(metrics_summary, indent=2, ensure_ascii=False)

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=2000,
        system=EVAL_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Analyze these weekly content performance metrics:\n{metrics_str}",
        }],
    )

    text = response.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def _mock_evaluation(metrics_summary: list[dict]) -> dict:
    top = metrics_summary[0] if metrics_summary else {"title": "N/A", "engagement": 0}
    return {
        "insights": f"Top performer was '{top.get('title', 'N/A')}' with {top.get('engagement', 0)} engagements. Carousel content continues to outperform other formats.",
        "recommendations": [
            {"action": "Create more carousel content on similar topics", "priority": "high", "reasoning": "Carousels had 3x engagement vs other formats"},
            {"action": "Translate top performers to ES and PT", "priority": "medium", "reasoning": "Multi-language content expands reach with minimal effort"},
        ],
    }
