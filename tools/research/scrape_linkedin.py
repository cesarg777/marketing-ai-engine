"""
Fetch LinkedIn B2B content via Google site-search (SerpApi).

Usage:
    python tools/research/scrape_linkedin.py --niches marketing,tech

Notes:
    Direct LinkedIn scraping is unreliable and legally gray.
    We use Google site:linkedin.com/posts searches via SerpApi.
    Upgrade path: Apify LinkedIn Post Scraper for richer data.
"""
import argparse
import json
from datetime import date

import httpx

from tools.config import Config


def fetch_linkedin(niches: list[str], results_per_niche: int = 10) -> list[dict]:
    """Fetch LinkedIn posts about B2B topics via Google site-search."""
    if not Config.SERPAPI_KEY:
        return _mock_linkedin(niches)

    all_results = []
    for niche in niches:
        query = f'site:linkedin.com/posts "B2B" "{niche}" "challenges" OR "problems" OR "pain points"'
        params = {
            "engine": "google",
            "q": query,
            "num": results_per_niche,
            "tbs": "qdr:w",  # Past week
            "api_key": Config.SERPAPI_KEY,
        }

        try:
            response = httpx.get("https://serpapi.com/search", params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            for result in data.get("organic_results", []):
                all_results.append({
                    "title": result.get("title", ""),
                    "snippet": result.get("snippet", ""),
                    "url": result.get("link", ""),
                    "niche": niche,
                    "source": "linkedin_via_google",
                })
        except Exception as e:
            print(f"Warning: LinkedIn search failed for {niche}: {e}")

    _save_to_tmp(all_results)
    return all_results


def _mock_linkedin(niches: list[str]) -> list[dict]:
    """Return mock data when no API key is configured."""
    return [
        {
            "title": f"The biggest {niche} challenge in B2B right now",
            "snippet": f"Teams are struggling with {niche} automation and ROI measurement...",
            "url": "https://linkedin.com/posts/example",
            "niche": niche,
            "source": "linkedin_mock",
        }
        for niche in niches
    ]


def _save_to_tmp(data: list[dict]):
    tmp_dir = Config.TMP_DIR / "research"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    filepath = tmp_dir / f"linkedin_{date.today().isoformat()}.json"
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--niches", required=True)
    args = parser.parse_args()

    niches = [n.strip() for n in args.niches.split(",")]
    results = fetch_linkedin(niches)
    print(f"Fetched {len(results)} LinkedIn results")
