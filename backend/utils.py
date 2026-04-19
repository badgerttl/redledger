import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.models import ChecklistItem

_CHECKLIST_PATH = Path(__file__).resolve().parent / "checklists" / "defaults.json"


def seed_checklists(db: Session, engagement_id: int) -> None:
    """Clone default checklist items into a new engagement."""
    if not _CHECKLIST_PATH.exists():
        return
    with open(_CHECKLIST_PATH) as f:
        defaults = json.load(f)
    order = 0
    for phase_name, items in defaults.items():
        for item in items:
            db.add(ChecklistItem(
                engagement_id=engagement_id,
                phase=phase_name,
                label=item.get("label", ""),
                description=item.get("description", ""),
                is_checked=False,
                sort_order=order,
            ))
            order += 1
    db.commit()
