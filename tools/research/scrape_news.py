"""
Scrape industry news via SerpApi Google News engine.

Usage:
    python tools/research/scrape_news.py --niche tech --country US
"""
import argparse
import json
from datetime import date

import httpx

from tools.config import Config


def fetch_news(niche: str, country: str, limit: int = 15) -> list[dict]:
    """Fetch recent B2B industry news articles."""
    if not Config.SERPAPI_KEY:
        return _mock_news(niche, country)

    params = {
        "engine": "google_news",
        "q": f"B2B {niche} sales challenges problems",
        "gl": country.lower(),
        "api_key": Config.SERPAPI_KEY,
    }

    response = httpx.get("https://serpapi.com/search", params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    results = []
    for article in data.get("news_results", [])[:limit]:
        results.append({
            "title": article.get("title", ""),
            "snippet": article.get("snippet", ""),
            "url": article.get("link", ""),
            "source_name": article.get("source", {}).get("name", ""),
            "date": article.get("date", ""),
            "niche": niche,
            "country": country,
        })

    _save_to_tmp(results, niche, country)
    return results


def _mock_news(niche: str, country: str) -> list[dict]:
    return [
        {
            "title": f"B2B {niche} teams face new challenges in 2026",
            "snippet": "Industry leaders report increasing complexity...",
            "url": "https://example.com/news",
            "source_name": "Industry Weekly",
            "niche": niche,
            "country": country,
        }
    ]


def _save_to_tmp(data: list[dict], niche: str, country: str):
    tmp_dir = Config.TMP_DIR / "research"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    filepath = tmp_dir / f"news_{niche}_{country}_{date.today().isoformat()}.json"
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", required=True)
    parser.add_argument("--country", required=True)
    args = parser.parse_args()

    results = fetch_news(args.niche, args.country)
    print(json.dumps(results, indent=2))
