from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChatMessage

router = APIRouter(tags=["chat"])

VALID_CONTEXT_TYPES = {"engagement", "asset"}


class MessageIn(BaseModel):
    role: str
    content: str


@router.get("/chat/{context_type}/{context_id}")
def get_chat(context_type: str, context_id: int, db: Session = Depends(get_db)):
    if context_type not in VALID_CONTEXT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid context_type: {context_type}")
    msgs = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.context_type == context_type,
            ChatMessage.context_id == context_id,
        )
        .order_by(ChatMessage.id)
        .all()
    )
    return [{"id": m.id, "role": m.role, "content": m.content} for m in msgs]


@router.post("/chat/{context_type}/{context_id}", status_code=201)
def append_chat(
    context_type: str,
    context_id: int,
    messages: list[MessageIn],
    db: Session = Depends(get_db),
):
    if context_type not in VALID_CONTEXT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid context_type: {context_type}")
    if not messages:
        return []
    created = []
    for m in messages:
        role = m.role if m.role in {"user", "assistant", "system"} else "user"
        row = ChatMessage(context_type=context_type, context_id=context_id, role=role, content=m.content)
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return [{"id": r.id, "role": r.role, "content": r.content} for r in created]


@router.delete("/chat/{context_type}/{context_id}")
def clear_chat(context_type: str, context_id: int, db: Session = Depends(get_db)):
    if context_type not in VALID_CONTEXT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid context_type: {context_type}")
    deleted = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.context_type == context_type,
            ChatMessage.context_id == context_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}
