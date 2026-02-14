from __future__ import annotations
import logging
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.database import get_db, SessionLocal
from backend.models.research import ResearchWeek, ResearchProblem
from backend.schemas.research import (
    ResearchTriggerRequest, ResearchProblemResponse, ResearchWeekResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/weeks", response_model=list[ResearchWeekResponse])
def list_weeks(limit: int = 10, db: Session = Depends(get_db)):
    weeks = (
        db.query(ResearchWeek)
        .order_by(ResearchWeek.week_start.desc())
        .limit(limit)
        .all()
    )
    results = []
    for w in weeks:
        data = ResearchWeekResponse.model_validate(w)
        data.problem_count = len(w.problems)
        results.append(data)
    return results


@router.get("/weeks/{week_id}")
def get_week(week_id: int, db: Session = Depends(get_db)):
    week = db.query(ResearchWeek).filter(ResearchWeek.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Research week not found")
    return {
        "week": ResearchWeekResponse.model_validate(week),
        "problems": [ResearchProblemResponse.model_validate(p) for p in week.problems],
    }


@router.get("/problems", response_model=list[ResearchProblemResponse])
def list_problems(
    niche: str | None = None,
    country: str | None = None,
    week_id: int | None = None,
    min_severity: int = 0,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(ResearchProblem)
    if niche:
        query = query.filter(ResearchProblem.primary_niche == niche)
    if country:
        query = query.filter(ResearchProblem.country == country)
    if week_id:
        query = query.filter(ResearchProblem.week_id == week_id)
    if min_severity > 0:
        query = query.filter(ResearchProblem.severity >= min_severity)
    return (
        query.order_by(ResearchProblem.severity.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/problems/{problem_id}", response_model=ResearchProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    problem = db.query(ResearchProblem).filter(ResearchProblem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


def _run_research_background(week_start: date, niches: list[str], countries: list[str]):
    """Background task: run the research pipeline with its own DB session."""
    from backend.services.research_service import run_research_pipeline

    db = SessionLocal()
    try:
        logger.info("Starting research pipeline for week %s", week_start)
        week = run_research_pipeline(
            db=db,
            week_start=week_start,
            niches=niches,
            countries=countries,
        )
        logger.info("Research pipeline completed: %d problems found", len(week.problems))
    except Exception:
        logger.exception("Research pipeline failed for week %s", week_start)
    finally:
        db.close()


@router.post("/trigger")
def trigger_research(
    data: ResearchTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger a new weekly research run. Runs asynchronously in background."""
    from tools.config import Config

    week_start = data.week_start or date.today()
    niches = data.niches or Config.DEFAULT_NICHES
    countries = data.countries or Config.DEFAULT_COUNTRIES

    existing = db.query(ResearchWeek).filter(ResearchWeek.week_start == week_start).first()
    if existing and existing.status == "running":
        raise HTTPException(status_code=409, detail="Research already running for this week")

    if not existing:
        existing = ResearchWeek(week_start=week_start, status="pending")
        db.add(existing)
        db.commit()
        db.refresh(existing)

    background_tasks.add_task(_run_research_background, week_start, niches, countries)

    return {
        "week_id": existing.id,
        "week_start": str(week_start),
        "niches": niches,
        "countries": countries,
        "status": "queued",
        "message": "Research pipeline started. Use GET /api/research/weeks/{week_id} to check status.",
    }
