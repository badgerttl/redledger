from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ActivityLog, Engagement

router = APIRouter(tags=["activity_log"])


class ActivityLogCreate(BaseModel):
    action: str
    target: str = ""
    phase: str = ""
    notes: str = ""


def _serialize(a: ActivityLog) -> dict:
    return {
        "id": a.id,
        "engagement_id": a.engagement_id,
        "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        "action": a.action,
        "target": a.target,
        "phase": a.phase,
        "notes": a.notes,
    }


@router.get("/engagements/{engagement_id}/activity-log")
def list_activity_log(
    engagement_id: int,
    phase: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(ActivityLog).filter(ActivityLog.engagement_id == engagement_id)
    if phase:
        q = q.filter(ActivityLog.phase == phase)
    total = q.count()
    items = q.order_by(ActivityLog.timestamp.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(a) for a in items]}


@router.post("/engagements/{engagement_id}/activity-log", status_code=201)
def create_activity_log(engagement_id: int, body: ActivityLogCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    entry = ActivityLog(engagement_id=engagement_id, **body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialize(entry)
