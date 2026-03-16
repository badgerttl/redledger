from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Note, Asset, Tag

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
    return [_serialize(n) for n in db.query(Note).filter(Note.asset_id == asset_id).order_by(Note.created_at.desc()).all()]


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
