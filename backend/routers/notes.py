from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Note, Asset, Tag, FindingNote, Finding, EngagementNote, Engagement

router = APIRouter(tags=["notes"])


class NoteCreate(BaseModel):
    body: str = ""


class NoteUpdate(BaseModel):
    body: Optional[str] = None
    tag_ids: Optional[list[int]] = None


def _serialize(n: Note) -> dict:
    return {
        "id": n.id,
        "asset_id": n.asset_id,
        "body": n.body,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in n.tags],
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.get("/assets/{asset_id}/notes")
def list_notes(asset_id: int, db: Session = Depends(get_db)):
    return [
        _serialize(n)
        for n in db.query(Note)
        .filter(Note.asset_id == asset_id)
        .order_by(Note.created_at.asc(), Note.id.asc())
        .all()
    ]


@router.post("/assets/{asset_id}/notes", status_code=201)
def create_note(asset_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    if not db.query(Asset).filter(Asset.id == asset_id).first():
        raise HTTPException(404, "Asset not found")
    note = Note(asset_id=asset_id, **body.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize(note)


@router.patch("/notes/{note_id}")
def update_note(note_id: int, body: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    data = body.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    for k, v in data.items():
        setattr(note, k, v)
    if tag_ids is not None:
        note.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    db.commit()
    db.refresh(note)
    return _serialize(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()


# ── Finding notes ─────────────────────────────────────────────────────

def _serialize_finding_note(n: FindingNote) -> dict:
    return {
        "id": n.id,
        "finding_id": n.finding_id,
        "body": n.body,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.get("/findings/{finding_id}/notes")
def list_finding_notes(finding_id: int, db: Session = Depends(get_db)):
    return [
        _serialize_finding_note(n)
        for n in db.query(FindingNote)
        .filter(FindingNote.finding_id == finding_id)
        .order_by(FindingNote.created_at.asc(), FindingNote.id.asc())
        .all()
    ]


@router.post("/findings/{finding_id}/notes", status_code=201)
def create_finding_note(finding_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    if not db.query(Finding).filter(Finding.id == finding_id).first():
        raise HTTPException(404, "Finding not found")
    note = FindingNote(finding_id=finding_id, **body.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_finding_note(note)


@router.patch("/finding-notes/{note_id}")
def update_finding_note(note_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    note = db.query(FindingNote).filter(FindingNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    note.body = body.body
    db.commit()
    db.refresh(note)
    return _serialize_finding_note(note)


@router.delete("/finding-notes/{note_id}", status_code=204)
def delete_finding_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(FindingNote).filter(FindingNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()


# ── Engagement notes ──────────────────────────────────────────────────

def _serialize_engagement_note(n: EngagementNote) -> dict:
    return {
        "id": n.id,
        "engagement_id": n.engagement_id,
        "body": n.body,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.get("/engagements/{engagement_id}/notes")
def list_engagement_notes(engagement_id: int, db: Session = Depends(get_db)):
    return [
        _serialize_engagement_note(n)
        for n in db.query(EngagementNote)
        .filter(EngagementNote.engagement_id == engagement_id)
        .order_by(EngagementNote.created_at.asc(), EngagementNote.id.asc())
        .all()
    ]


@router.post("/engagements/{engagement_id}/notes", status_code=201)
def create_engagement_note(engagement_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    note = EngagementNote(engagement_id=engagement_id, **body.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_engagement_note(note)


@router.patch("/engagement-notes/{note_id}")
def update_engagement_note(note_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    note = db.query(EngagementNote).filter(EngagementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    note.body = body.body
    db.commit()
    db.refresh(note)
    return _serialize_engagement_note(note)


@router.delete("/engagement-notes/{note_id}", status_code=204)
def delete_engagement_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(EngagementNote).filter(EngagementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()
