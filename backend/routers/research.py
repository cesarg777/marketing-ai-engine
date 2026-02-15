from __future__ import annotations
import logging
from datetime import date, datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from backend.database import get_db, SessionLocal
from backend.auth import get_current_org_id
from backend.models.research import ResearchWeek, ResearchProblem
from backend.models.research_config import ResearchConfig
from backend.schemas.research import (
    ResearchTriggerRequest, ResearchProblemResponse, ResearchWeekResponse,
)
from backend.schemas.research_config import (
    ResearchConfigCreate, ResearchConfigUpdate, ResearchConfigResponse,
)
from backend.security import validate_uuid, limiter, safe_update, RESEARCH_CONFIG_UPDATE_FIELDS

logger = logging.getLogger(__name__)
router = APIRouter()

STALE_RUNNING_MINUTES = 30


def _reset_if_stale(week: ResearchWeek, db: Session) -> None:
    """Reset a research week stuck in 'running' for too long."""
    if week.status != "running":
        return
    elapsed = datetime.utcnow() - (week.created_at or datetime.utcnow())
    if elapsed > timedelta(minutes=STALE_RUNNING_MINUTES):
        logger.warning("Resetting stale research week %s (running for %s)", week.id, elapsed)
        week.status = "failed"
        db.commit()


@router.get("/weeks", response_model=list[ResearchWeekResponse])
def list_weeks(
    limit: int = 10,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    weeks = (
        db.query(ResearchWeek)
        .filter(ResearchWeek.org_id == org_id)
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
def get_week(
    week_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(week_id, "week_id")
    week = (
        db.query(ResearchWeek)
        .filter(ResearchWeek.id == week_id, ResearchWeek.org_id == org_id)
        .first()
    )
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
    week_id: str | None = None,
    min_severity: int = 0,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    query = (
        db.query(ResearchProblem)
        .join(ResearchWeek, ResearchProblem.week_id == ResearchWeek.id)
        .filter(ResearchWeek.org_id == org_id)
    )
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
def get_problem(
    problem_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(problem_id, "problem_id")
    problem = (
        db.query(ResearchProblem)
        .join(ResearchWeek, ResearchProblem.week_id == ResearchWeek.id)
        .filter(ResearchProblem.id == problem_id, ResearchWeek.org_id == org_id)
        .first()
    )
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


def _run_research_background(
    week_start: date,
    niches: list[str],
    countries: list[str],
    org_id: str,
    decision_makers: list[str] | None = None,
    keywords: list[str] | None = None,
):
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
            org_id=org_id,
            decision_makers=decision_makers or [],
            keywords=keywords or [],
        )
        logger.info("Research pipeline completed: %d problems found", len(week.problems))
    except Exception:
        logger.exception("Research pipeline failed for week %s", week_start)
    finally:
        db.close()


@router.post("/trigger")
@limiter.limit("5/minute")
def trigger_research(
    request: Request,
    data: ResearchTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Trigger a new weekly research run. Runs asynchronously in background."""
    from tools.config import Config

    week_start = data.week_start or date.today()
    niches = data.niches or Config.DEFAULT_NICHES
    countries = data.countries or Config.DEFAULT_COUNTRIES

    existing = (
        db.query(ResearchWeek)
        .filter(ResearchWeek.week_start == week_start, ResearchWeek.org_id == org_id)
        .first()
    )
    if existing:
        _reset_if_stale(existing, db)
    if existing and existing.status == "running":
        raise HTTPException(status_code=409, detail="Research already running for this week")

    if not existing:
        existing = ResearchWeek(week_start=week_start, status="pending", org_id=org_id)
        db.add(existing)
        db.commit()
        db.refresh(existing)

    background_tasks.add_task(_run_research_background, week_start, niches, countries, org_id)

    return {
        "week_id": existing.id,
        "week_start": str(week_start),
        "niches": niches,
        "countries": countries,
        "status": "queued",
        "message": "Research pipeline started. Use GET /api/research/weeks/{week_id} to check status.",
    }


# ────────── Research Configs ──────────


@router.get("/configs", response_model=list[ResearchConfigResponse])
def list_configs(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    return (
        db.query(ResearchConfig)
        .filter(ResearchConfig.org_id == org_id, ResearchConfig.is_active == True)
        .order_by(ResearchConfig.created_at.desc())
        .all()
    )


@router.get("/configs/{config_id}", response_model=ResearchConfigResponse)
def get_config(
    config_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(config_id, "config_id")
    config = (
        db.query(ResearchConfig)
        .filter(ResearchConfig.id == config_id, ResearchConfig.org_id == org_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Research config not found")
    return config


@router.post("/configs", response_model=ResearchConfigResponse, status_code=201)
def create_config(
    data: ResearchConfigCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    existing = (
        db.query(ResearchConfig)
        .filter(
            ResearchConfig.org_id == org_id,
            ResearchConfig.name == data.name,
            ResearchConfig.is_active == True,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A config with this name already exists")
    config = ResearchConfig(org_id=org_id, **data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.put("/configs/{config_id}", response_model=ResearchConfigResponse)
def update_config(
    config_id: str,
    data: ResearchConfigUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(config_id, "config_id")
    config = (
        db.query(ResearchConfig)
        .filter(ResearchConfig.id == config_id, ResearchConfig.org_id == org_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Research config not found")
    safe_update(config, data.model_dump(exclude_none=True), RESEARCH_CONFIG_UPDATE_FIELDS)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/configs/{config_id}")
def delete_config(
    config_id: str,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    validate_uuid(config_id, "config_id")
    config = (
        db.query(ResearchConfig)
        .filter(ResearchConfig.id == config_id, ResearchConfig.org_id == org_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Research config not found")
    config.is_active = False
    db.commit()
    return {"detail": "Config deleted"}


@router.post("/configs/{config_id}/run")
@limiter.limit("5/minute")
def run_config(
    request: Request,
    config_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Trigger research using a saved config's niches/countries."""
    validate_uuid(config_id, "config_id")
    config = (
        db.query(ResearchConfig)
        .filter(ResearchConfig.id == config_id, ResearchConfig.org_id == org_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Research config not found")

    week_start = date.today()
    niches = config.niches or []
    countries = config.countries or []
    decision_makers = getattr(config, "decision_makers", None) or []
    keywords = getattr(config, "keywords", None) or []

    existing_week = (
        db.query(ResearchWeek)
        .filter(ResearchWeek.week_start == week_start, ResearchWeek.org_id == org_id)
        .first()
    )
    if existing_week:
        _reset_if_stale(existing_week, db)
    if existing_week and existing_week.status == "running":
        raise HTTPException(status_code=409, detail="Research already running for this week")

    if not existing_week:
        existing_week = ResearchWeek(week_start=week_start, status="pending", org_id=org_id)
        db.add(existing_week)
        db.commit()
        db.refresh(existing_week)

    background_tasks.add_task(
        _run_research_background, week_start, niches, countries, org_id,
        decision_makers=decision_makers, keywords=keywords,
    )

    return {
        "week_id": existing_week.id,
        "config_id": config.id,
        "config_name": config.name,
        "week_start": str(week_start),
        "niches": niches,
        "countries": countries,
        "status": "queued",
    }
