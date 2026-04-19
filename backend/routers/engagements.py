from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Engagement, Scope
from backend.utils import seed_checklists

router = APIRouter(tags=["engagements"])


class EngagementCreate(BaseModel):
    name: str
    description: str = ""
    client_name: str = ""
    client_contact: str = ""
    start_date: str = ""
    end_date: str = ""
    rules_of_engagement: str = ""


class EngagementUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    client_name: Optional[str] = None
    client_contact: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rules_of_engagement: Optional[str] = None


def _serialize(e: Engagement) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "description": e.description,
        "status": e.status,
        "client_name": e.client_name,
        "client_contact": e.client_contact,
        "start_date": e.start_date,
        "end_date": e.end_date,
        "rules_of_engagement": e.rules_of_engagement,
        "authorization_doc": e.authorization_doc,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/engagements")
def list_engagements(db: Session = Depends(get_db)):
    return [_serialize(e) for e in db.query(Engagement).order_by(Engagement.updated_at.desc()).all()]


@router.post("/engagements", status_code=201)
def create_engagement(body: EngagementCreate, db: Session = Depends(get_db)):
    eng = Engagement(**body.model_dump())
    db.add(eng)
    db.flush()
    db.add(Scope(engagement_id=eng.id, in_scope="", out_scope=""))
    db.commit()
    db.refresh(eng)
    seed_checklists(db, eng.id)
    return _serialize(eng)


@router.get("/engagements/{engagement_id}")
def get_engagement(engagement_id: int, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")
    return _serialize(eng)


@router.patch("/engagements/{engagement_id}")
def update_engagement(engagement_id: int, body: EngagementUpdate, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(eng, k, v)
    db.commit()
    db.refresh(eng)
    return _serialize(eng)


@router.delete("/engagements/{engagement_id}", status_code=204)
def delete_engagement(engagement_id: int, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")
    db.delete(eng)
    db.commit()
