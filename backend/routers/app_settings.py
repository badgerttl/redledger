from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Setting

router = APIRouter(tags=["settings"])

KNOWN_KEYS = {"assistant_system_prompt", "findings_gen_instructions", "assistant_context_limit", "code_review_system_prompt"}


def _all_settings(db: Session) -> dict:
    rows = db.query(Setting).filter(Setting.key.in_(KNOWN_KEYS)).all()
    result = {k: "" for k in KNOWN_KEYS}
    for row in rows:
        result[row.key] = row.value
    return result


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return _all_settings(db)


class SettingsPatch(BaseModel):
    assistant_system_prompt: str | None = None
    findings_gen_instructions: str | None = None
    assistant_context_limit: str | None = None
    code_review_system_prompt: str | None = None


@router.patch("/settings")
def patch_settings(body: SettingsPatch, db: Session = Depends(get_db)):
    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key not in KNOWN_KEYS:
            continue
        row = db.query(Setting).filter(Setting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
    db.commit()
    return _all_settings(db)
