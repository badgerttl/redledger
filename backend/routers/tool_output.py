from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ToolOutput, Engagement, Tag

router = APIRouter(tags=["tool_output"])


class ToolOutputCreate(BaseModel):
    tool_name: str = ""
    phase: str = ""
    content: str = ""
    asset_id: Optional[int] = None


class ToolOutputUpdate(BaseModel):
    tool_name: Optional[str] = None
    phase: Optional[str] = None
    content: Optional[str] = None
    asset_id: Optional[int] = None
    tag_ids: Optional[list[int]] = None


def _serialize(t: ToolOutput) -> dict:
    return {
        "id": t.id,
        "engagement_id": t.engagement_id,
        "asset_id": t.asset_id,
        "tool_name": t.tool_name,
        "phase": t.phase,
        "content": t.content,
        "source_file": t.source_file,
        "tags": [{"id": tg.id, "name": tg.name, "color": tg.color} for tg in t.tags],
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/engagements/{engagement_id}/tool-output")
def list_tool_output(
    engagement_id: int,
    phase: Optional[str] = Query(None),
    asset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ToolOutput).filter(ToolOutput.engagement_id == engagement_id)
    if phase:
        q = q.filter(ToolOutput.phase == phase)
    if asset_id:
        q = q.filter(ToolOutput.asset_id == asset_id)
    return [_serialize(t) for t in q.order_by(ToolOutput.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/tool-output", status_code=201)
def create_tool_output(engagement_id: int, body: ToolOutputCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    to = ToolOutput(engagement_id=engagement_id, **body.model_dump())
    db.add(to)
    db.commit()
    db.refresh(to)
    return _serialize(to)


@router.get("/tool-output/{tool_output_id}")
def get_tool_output(tool_output_id: int, db: Session = Depends(get_db)):
    to = db.query(ToolOutput).filter(ToolOutput.id == tool_output_id).first()
    if not to:
        raise HTTPException(404, "Tool output not found")
    return _serialize(to)


@router.patch("/tool-output/{tool_output_id}")
def update_tool_output(tool_output_id: int, body: ToolOutputUpdate, db: Session = Depends(get_db)):
    to = db.query(ToolOutput).filter(ToolOutput.id == tool_output_id).first()
    if not to:
        raise HTTPException(404, "Tool output not found")
    data = body.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    for k, v in data.items():
        setattr(to, k, v)
    if tag_ids is not None:
        to.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    db.commit()
    db.refresh(to)
    return _serialize(to)


@router.delete("/tool-output/{tool_output_id}", status_code=204)
def delete_tool_output(tool_output_id: int, db: Session = Depends(get_db)):
    to = db.query(ToolOutput).filter(ToolOutput.id == tool_output_id).first()
    if not to:
        raise HTTPException(404, "Tool output not found")
    db.delete(to)
    db.commit()
