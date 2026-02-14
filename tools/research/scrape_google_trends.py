"""
Scrape Google Trends for B2B topics by niche and country.

Usage:
    python tools/research/scrape_google_trends.py --niche marketing --country US

Output:
    Returns list of trending data points.
    Writes JSON to .tmp/research/trends_{niche}_{country}_{date}.json
"""
import argparse
import json
from datetime import date
from pathlib import Path

import httpx

from tools.config import Config


def fetch_trends(niche: str, country: str) -> list[dict]:
    """Fetch Google Trends data for B2B topics in a given niche and country."""
    if not Config.SERPAPI_KEY:
        return _mock_trends(niche, country)

    queries = f"B2B {niche} problems,{niche} challenges,{niche} pain points"
    params = {
        "engine": "google_trends",
        "q": queries,
        "geo": country,
        "date": "now 7-d",
        "api_key": Config.SERPAPI_KEY,
    }

    response = httpx.get("https://serpapi.com/search", params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    results = []
    timeline = data.get("interest_over_time", {}).get("timeline_data", [])
    for point in timeline:
        for value in point.get("values", []):
            results.append({
                "query": value.get("query", ""),
                "value": value.get("extracted_value", 0),
                "date": point.get("date", ""),
                "niche": niche,
                "country": country,
            })

    # Also get related queries
    related = data.get("related_queries", {})
    for category in related.values():
        for item in category.get("rising", []) + category.get("top", []):
            results.append({
                "query": item.get("query", ""),
                "value": item.get("extracted_value", 0),
                "type": "related_query",
                "niche": niche,
                "country": country,
            })

    _save_to_tmp(results, niche, country)
    return results


def _mock_trends(niche: str, country: str) -> list[dict]:
    """Return mock data when no API key is configured."""
    return [
        {
            "query": f"B2B {niche} lead generation challenges",
            "value": 85,
            "type": "mock",
            "niche": niche,
            "country": country,
        },
        {
            "query": f"{niche} sales pipeline problems",
            "value": 72,
            "type": "mock",
            "niche": niche,
            "country": country,
        },
    ]


def _save_to_tmp(data: list[dict], niche: str, country: str):
    """Save results to .tmp for the aggregator."""
    tmp_dir = Config.TMP_DIR / "research"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    filepath = tmp_dir / f"trends_{niche}_{country}_{date.today().isoformat()}.json"
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Google Trends for B2B topics")
    parser.add_argument("--niche", required=True)
    parser.add_argument("--country", required=True)
    args = parser.parse_args()

    results = fetch_trends(args.niche, args.country)
    print(json.dumps(results, indent=2, ensure_ascii=False))
