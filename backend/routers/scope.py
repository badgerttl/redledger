from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Scope, ScopeEntry, Engagement

router = APIRouter(tags=["scope"])


class ScopeUpdate(BaseModel):
    in_scope: Optional[str] = None
    out_scope: Optional[str] = None


class ScopeEntryCreate(BaseModel):
    entry_type: str
    value: str


def _serialize_scope(s: Scope) -> dict:
    return {"id": s.id, "engagement_id": s.engagement_id, "in_scope": s.in_scope, "out_scope": s.out_scope}


def _serialize_entry(e: ScopeEntry) -> dict:
    return {"id": e.id, "engagement_id": e.engagement_id, "entry_type": e.entry_type, "value": e.value}


@router.get("/engagements/{engagement_id}/scope")
def get_scope(engagement_id: int, db: Session = Depends(get_db)):
    s = db.query(Scope).filter(Scope.engagement_id == engagement_id).first()
    if not s:
        raise HTTPException(404, "Scope not found")
    return _serialize_scope(s)


@router.put("/engagements/{engagement_id}/scope")
def update_scope(engagement_id: int, body: ScopeUpdate, db: Session = Depends(get_db)):
    s = db.query(Scope).filter(Scope.engagement_id == engagement_id).first()
    if not s:
        raise HTTPException(404, "Scope not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _serialize_scope(s)


@router.get("/engagements/{engagement_id}/scope-entries")
def list_scope_entries(engagement_id: int, db: Session = Depends(get_db)):
    return [_serialize_entry(e) for e in db.query(ScopeEntry).filter(ScopeEntry.engagement_id == engagement_id).all()]


@router.post("/engagements/{engagement_id}/scope-entries", status_code=201)
def create_scope_entry(engagement_id: int, body: ScopeEntryCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    entry = ScopeEntry(engagement_id=engagement_id, **body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialize_entry(entry)


@router.delete("/scope-entries/{entry_id}", status_code=204)
def delete_scope_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(ScopeEntry).filter(ScopeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Scope entry not found")
    db.delete(entry)
    db.commit()
