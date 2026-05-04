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


def add_missing_default_checklists(db: Session, engagement_id: int) -> dict:
    """Add missing default methodology items and normalize their order."""
    if not _CHECKLIST_PATH.exists():
        return {"added": 0, "updated": 0}
    with open(_CHECKLIST_PATH) as f:
        defaults = json.load(f)

    existing = db.query(ChecklistItem).filter(
        ChecklistItem.engagement_id == engagement_id
    ).all()
    aliases = {
        "Reconnaissance": {
            "OSINT — search engine dorking": "OSINT - search engine dorking",
            "WHOIS lookup": "WHOIS and registrar lookup",
            "Email harvesting": "Email and identity discovery",
        },
        "Scanning and Enumeration": {
            "Web directory brute-forcing": "Web crawling and content discovery",
            "SMB enumeration": "SMB / NetBIOS enumeration",
        },
        "Exploitation": {
            "Authentication brute-force": "Weak credential and password attack testing",
            "LFI/RFI testing": "LFI/RFI and path traversal testing",
        },
        "Reporting": {
            "Assign CVSS scores": "Assign severity and CVSS scores",
        },
    }
    delete_aliases = {
        (phase, old.strip().casefold()): new.strip().casefold()
        for phase, phase_aliases in aliases.items()
        for old, new in phase_aliases.items()
    }

    def norm(value: str) -> str:
        return value.strip().casefold()

    items_by_key = {
        (item.phase, norm(item.label)): item
        for item in existing
    }
    added = 0
    updated = 0

    for phase_name, items in defaults.items():
        for item in items:
            label = item.get("label", "").strip()
            description = item.get("description", "")
            if not label:
                continue

            key = (phase_name, norm(label))
            existing_item = items_by_key.get(key)

            if not existing_item:
                legacy_label = next(
                    (
                        old
                        for old, new in aliases.get(phase_name, {}).items()
                        if new == label and (phase_name, norm(old)) in items_by_key
                    ),
                    None,
                )
                if legacy_label:
                    existing_item = items_by_key[(phase_name, norm(legacy_label))]

            if existing_item:
                if existing_item.label != label or existing_item.description != description:
                    existing_item.label = label
                    existing_item.description = description
                    updated += 1
                items_by_key[key] = existing_item
                continue

            db.add(ChecklistItem(
                engagement_id=engagement_id,
                phase=phase_name,
                label=label,
                description=description,
                is_checked=False,
                sort_order=0,
            ))
            added += 1

    db.flush()

    ordered_items = db.query(ChecklistItem).filter(
        ChecklistItem.engagement_id == engagement_id
    ).all()
    latest_by_key = {
        (item.phase, norm(item.label)): item
        for item in ordered_items
    }
    for item in list(ordered_items):
        replacement_label = delete_aliases.get((item.phase, norm(item.label)))
        if not replacement_label:
            continue
        replacement = latest_by_key.get((item.phase, replacement_label))
        if not replacement or replacement.id == item.id:
            continue
        replacement.is_checked = bool(replacement.is_checked or item.is_checked)
        replacement.is_na = bool(getattr(replacement, "is_na", False) or getattr(item, "is_na", False))
        db.delete(item)
        ordered_items.remove(item)
        updated += 1

    default_phase_order = list(defaults.keys())
    default_label_order = {
        (phase_name, norm(item.get("label", ""))): idx
        for phase_name, items in defaults.items()
        for idx, item in enumerate(items)
    }

    order = 0
    for phase_name in default_phase_order:
        phase_items = [item for item in ordered_items if item.phase == phase_name]
        phase_items.sort(key=lambda item: (
            default_label_order.get((phase_name, norm(item.label)), 10_000),
            item.sort_order or 0,
            item.id or 0,
        ))
        for item in phase_items:
            if item.sort_order != order:
                item.sort_order = order
                updated += 1
            order += 1

    other_items = [
        item for item in ordered_items
        if item.phase not in default_phase_order
    ]
    other_items.sort(key=lambda item: (item.sort_order or 0, item.id or 0))
    for item in other_items:
        if item.sort_order != order:
            item.sort_order = order
            updated += 1
        order += 1

    db.commit()
    return {"added": added, "updated": updated}
