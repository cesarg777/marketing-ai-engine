"""
Scrape Reddit for B2B sales pain points from relevant subreddits.

Usage:
    python tools/research/scrape_reddit.py --niches marketing,tech,hr

Output:
    Returns list of relevant posts with titles, scores, and content.
"""
import argparse
import json
from datetime import date

import httpx

from tools.config import Config

# B2B-relevant subreddits mapped to niches
SUBREDDIT_MAP = {
    "marketing": ["B2BMarketing", "marketing", "digital_marketing", "PPC"],
    "tech": ["SaaS", "startups", "technology", "ITManagers"],
    "hr": ["humanresources", "recruiting", "AskHR"],
    "consulting": ["consulting", "management_consulting"],
    "finance": ["FinancialPlanning", "CFO"],
    "healthcare": ["healthIT", "healthcare"],
    "legal": ["LawFirm"],
    "saas": ["SaaS", "microsaas", "EntrepreneurRideAlong"],
    "sales": ["sales", "salesforce"],
}

HEADERS = {"User-Agent": "SieteMarketingEngine/0.1 (research bot)"}


def fetch_reddit(niches: list[str], limit_per_sub: int = 25) -> list[dict]:
    """Fetch top posts from B2B-relevant subreddits."""
    subreddits = set()
    for niche in niches:
        subreddits.update(SUBREDDIT_MAP.get(niche, []))
    # Always include general B2B/sales subs
    subreddits.update(["sales", "B2BMarketing"])

    results = []
    for sub in subreddits:
        try:
            posts = _fetch_subreddit(sub, limit_per_sub)
            results.extend(posts)
        except Exception as e:
            print(f"Warning: Failed to scrape r/{sub}: {e}")

    _save_to_tmp(results)
    return results


def _fetch_subreddit(subreddit: str, limit: int) -> list[dict]:
    """Fetch top posts from a subreddit using Reddit's JSON API."""
    url = f"https://www.reddit.com/r/{subreddit}/hot.json"
    params = {"limit": limit, "t": "week"}

    response = httpx.get(url, params=params, headers=HEADERS, timeout=15)
    response.raise_for_status()
    data = response.json()

    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        if post.get("stickied"):
            continue
        posts.append({
            "subreddit": subreddit,
            "title": post.get("title", ""),
            "selftext": post.get("selftext", "")[:500],
            "score": post.get("score", 0),
            "num_comments": post.get("num_comments", 0),
            "url": f"https://reddit.com{post.get('permalink', '')}",
            "created_utc": post.get("created_utc", 0),
        })
    return posts


def _save_to_tmp(data: list[dict]):
    tmp_dir = Config.TMP_DIR / "research"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    filepath = tmp_dir / f"reddit_{date.today().isoformat()}.json"
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--niches", required=True, help="Comma-separated niches")
    args = parser.parse_args()

    niches = [n.strip() for n in args.niches.split(",")]
    results = fetch_reddit(niches)
    print(f"Fetched {len(results)} posts from Reddit")
    print(json.dumps(results[:3], indent=2))
