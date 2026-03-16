from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChecklistItem

router = APIRouter(tags=["checklists"])


class ChecklistToggle(BaseModel):
    is_checked: Optional[bool] = None


def _serialize(c: ChecklistItem) -> dict:
    return {
        "id": c.id,
        "engagement_id": c.engagement_id,
        "phase": c.phase,
        "label": c.label,
        "description": c.description,
        "is_checked": c.is_checked,
        "sort_order": c.sort_order,
    }


@router.get("/engagements/{engagement_id}/checklists")
def list_checklists(engagement_id: int, db: Session = Depends(get_db)):
    items = db.query(ChecklistItem).filter(
        ChecklistItem.engagement_id == engagement_id
    ).order_by(ChecklistItem.sort_order).all()
    grouped: dict[str, list] = {}
    for item in items:
        grouped.setdefault(item.phase, []).append(_serialize(item))
    return grouped


@router.patch("/checklists/{item_id}")
def toggle_checklist(item_id: int, body: ChecklistToggle, db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    if body.is_checked is not None:
        item.is_checked = body.is_checked
    db.commit()
    db.refresh(item)
    return _serialize(item)
