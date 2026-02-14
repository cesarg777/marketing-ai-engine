"""
Weekly research pipeline orchestrator.
Runs all scrapers, aggregates with Claude, and stores results.

Usage:
    python scripts/run_weekly_research.py
    python scripts/run_weekly_research.py --niches marketing,tech --countries US,MX
"""
import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.config import Config
from backend.database import SessionLocal, create_tables
from backend.services.research_service import run_research_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run weekly B2B research pipeline")
    parser.add_argument("--niches", help="Comma-separated niches (default: all)")
    parser.add_argument("--countries", help="Comma-separated country codes (default: all)")
    parser.add_argument("--week", help="Week start date YYYY-MM-DD (default: today)")
    args = parser.parse_args()

    niches = [n.strip() for n in args.niches.split(",")] if args.niches else None
    countries = [c.strip() for c in args.countries.split(",")] if args.countries else None
    week_start = date.fromisoformat(args.week) if args.week else date.today()

    print(f"Starting weekly research for week of {week_start}")
    print(f"  Niches: {niches or Config.DEFAULT_NICHES}")
    print(f"  Countries: {countries or Config.DEFAULT_COUNTRIES}")
    print()

    create_tables()
    db = SessionLocal()

    try:
        week = run_research_pipeline(
            db=db,
            week_start=week_start,
            niches=niches,
            countries=countries,
        )
        print(f"\nResearch complete! Status: {week.status}")
        print(f"  Problems found: {len(week.problems)}")
    except Exception as e:
        print(f"\nResearch failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
