from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Tag

router = APIRouter(tags=["tags"])


class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


def _serialize(t: Tag) -> dict:
    return {"id": t.id, "name": t.name, "color": t.color}


@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    return [_serialize(t) for t in db.query(Tag).order_by(Tag.name).all()]


@router.post("/tags", status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == body.name).first()
    if existing:
        raise HTTPException(409, "Tag already exists")
    tag = Tag(**body.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return _serialize(tag)


@router.patch("/tags/{tag_id}")
def update_tag(tag_id: int, body: TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(404, "Tag not found")
    if body.name is not None:
        existing = db.query(Tag).filter(Tag.name == body.name, Tag.id != tag_id).first()
        if existing:
            raise HTTPException(409, "Tag name already exists")
        tag.name = body.name
    if body.color is not None:
        tag.color = body.color
    db.commit()
    db.refresh(tag)
    return _serialize(tag)


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(404, "Tag not found")
    db.delete(tag)
    db.commit()
