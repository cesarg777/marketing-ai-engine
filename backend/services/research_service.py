from __future__ import annotations
from datetime import date, datetime
from sqlalchemy.orm import Session
from backend.models.research import ResearchWeek, ResearchProblem
from tools.config import Config


def run_research_pipeline(
    db: Session,
    week_start: date,
    niches: list[str] | None = None,
    countries: list[str] | None = None,
) -> ResearchWeek:
    """Run the full research pipeline: scrape → aggregate → store."""
    niches = niches or Config.DEFAULT_NICHES
    countries = countries or Config.DEFAULT_COUNTRIES

    # Get or create week record
    week = db.query(ResearchWeek).filter(ResearchWeek.week_start == week_start).first()
    if not week:
        week = ResearchWeek(week_start=week_start)
        db.add(week)
        db.commit()
        db.refresh(week)

    week.status = "running"
    db.commit()

    try:
        # Step 1: Scrape all sources
        raw_data = _scrape_all_sources(niches, countries)

        # Step 2: Aggregate with Claude
        for niche in niches:
            for country in countries:
                niche_data = _filter_data(raw_data, niche, country)
                if not niche_data:
                    continue

                from tools.research.aggregate_problems import aggregate
                problems = aggregate(
                    raw_data=niche_data,
                    niche=niche,
                    country=country,
                )

                # Step 3: Store in database
                for p in problems:
                    problem = ResearchProblem(
                        week_id=week.id,
                        title=p["problem_title"],
                        description=p["problem_description"],
                        severity=p.get("severity", 5),
                        trending_direction=p.get("trending_direction", "stable"),
                        primary_niche=niche,
                        related_niches=p.get("related_niches", []),
                        country=country,
                        language=_country_to_language(country),
                        source_count=p.get("source_count", 0),
                        source_urls=p.get("source_urls", []),
                        suggested_angles=p.get("suggested_angles", []),
                        keywords=p.get("keywords", []),
                        language_variants=p.get("language_variants", {}),
                        raw_data=p.get("raw_data", {}),
                    )
                    db.add(problem)

        week.status = "completed"
        week.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        week.status = "failed"
        db.commit()
        raise

    db.refresh(week)
    return week


def _scrape_all_sources(niches: list[str], countries: list[str]) -> list[dict]:
    """Run all scrapers and collect raw data."""
    all_data = []

    for niche in niches:
        for country in countries:
            try:
                from tools.research.scrape_google_trends import fetch_trends
                trends = fetch_trends(niche, country)
                all_data.extend([{"source": "google_trends", "niche": niche, "country": country, **t} for t in trends])
            except Exception:
                pass

            try:
                from tools.research.scrape_news import fetch_news
                news = fetch_news(niche, country)
                all_data.extend([{"source": "news", "niche": niche, "country": country, **n} for n in news])
            except Exception:
                pass

    # Reddit and LinkedIn are not niche/country-specific
    try:
        from tools.research.scrape_reddit import fetch_reddit
        reddit = fetch_reddit(niches)
        all_data.extend([{"source": "reddit", **r} for r in reddit])
    except Exception:
        pass

    try:
        from tools.research.scrape_linkedin import fetch_linkedin
        linkedin = fetch_linkedin(niches)
        all_data.extend([{"source": "linkedin", **l} for l in linkedin])
    except Exception:
        pass

    return all_data


def _filter_data(raw_data: list[dict], niche: str, country: str) -> list[dict]:
    """Filter raw data relevant to a specific niche and country."""
    return [
        d for d in raw_data
        if d.get("niche", "") == niche or d.get("country", "") == country
        or d.get("source") in ("reddit", "linkedin")  # These are global sources
    ]


def _country_to_language(country: str) -> str:
    """Map country code to primary language."""
    mapping = {
        "US": "en", "GB": "en", "CA": "en", "AU": "en",
        "MX": "es", "CO": "es", "ES": "es", "AR": "es", "CL": "es", "PE": "es",
        "BR": "pt", "PT": "pt",
        "FR": "fr", "DE": "de", "IT": "it", "JP": "ja", "KR": "ko", "CN": "zh",
    }
    return mapping.get(country, "en")
