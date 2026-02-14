# Weekly Research Workflow

## Objective
Identify the top 10 B2B sales problems trending this week, segmented by niche and country.

## Inputs
- `niches`: list of industry verticals (default: all configured in tools/config.py)
- `countries`: list of country codes (default: all configured)
- `week_start`: ISO date string for the Monday of the target week

## Process

### Step 1: Data Collection
Run all scrapers in sequence. Each writes raw data to `.tmp/research/`:

1. **Google Trends** — `tools/research/scrape_google_trends.py`
   - Fetches trending B2B search terms per niche + country
   - Uses SerpApi Google Trends endpoint
   - Output: `.tmp/research/trends_{niche}_{country}_{date}.json`

2. **Reddit** — `tools/research/scrape_reddit.py`
   - Scrapes hot posts from B2B subreddits (r/sales, r/B2BMarketing, r/SaaS, etc.)
   - Uses Reddit's public JSON API (no auth needed)
   - Output: `.tmp/research/reddit_{date}.json`

3. **LinkedIn** — `tools/research/scrape_linkedin.py`
   - Searches Google for `site:linkedin.com/posts` with B2B keywords
   - Uses SerpApi (not direct LinkedIn scraping)
   - Output: `.tmp/research/linkedin_{date}.json`

4. **Industry News** — `tools/research/scrape_news.py`
   - Fetches B2B news via SerpApi Google News engine
   - Output: `.tmp/research/news_{niche}_{country}_{date}.json`

### Step 2: AI Aggregation
Run `tools/research/aggregate_problems.py` for each niche + country combination:
- Feed all scraped data to Claude (Opus model for best analysis quality)
- Claude identifies, deduplicates, and ranks the top 10 problems
- Each problem includes: title, description, severity, trending direction, sources, keywords, suggested content angles, multi-language title variants

### Step 3: Storage
Store results in the `research_problems` database table via the research service.

## Expected Output
- 10 problems per niche per country in the database
- JSON summary available at `.tmp/research/week_{date}_summary.json`
- Problems visible in the frontend Research Hub at `/research`

## Triggering
- **Manual**: POST `/api/research/trigger` or click "Run Research" in the frontend
- **Scheduled**: APScheduler runs every Monday at 6:00 AM (configured in backend)
- **CLI**: `python scripts/run_weekly_research.py --niches marketing,tech --countries US,MX`

## Edge Cases
- If a scraper fails, log the error and continue with available data
- If Claude API rate limited: exponential backoff, max 3 retries
- If fewer than 10 problems meet the 2-source threshold, return as many as qualify
- If SerpApi key not configured: scrapers return mock data for development

## Cost
- SerpApi: ~5 API calls per niche+country combination
- Claude Opus: ~$2-5 per aggregation run (large context)
- Total weekly cost at default scale: ~$15-25
