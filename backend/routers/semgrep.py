"""Semgrep results — store parsed semgrep JSON findings per engagement."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Engagement, SemgrepResult

router = APIRouter(tags=["semgrep"])


def _serialize(r: SemgrepResult) -> dict:
    return {
        "id": r.id,
        "engagement_id": r.engagement_id,
        "check_id": r.check_id,
        "path": r.path,
        "line": r.line,
        "col": r.col,
        "message": r.message,
        "severity": r.severity,
        "lines": r.lines,
        "technology": r.technology or "",
        "vulnerability_class": r.vulnerability_class or "",
        "likelihood": r.likelihood or "",
        "impact": r.impact or "",
        "confidence": r.confidence or "",
        "cwe": r.cwe or "",
        "owasp": r.owasp or "",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class SemgrepFinding(BaseModel):
    check_id: str = ""
    path: str = ""
    line: int = 0
    col: int = 0
    message: str = ""
    severity: str = ""
    lines: str = ""
    technology: str = ""
    vulnerability_class: str = ""
    likelihood: str = ""
    impact: str = ""
    confidence: str = ""
    cwe: str = ""
    owasp: str = ""


@router.get("/engagements/{engagement_id}/semgrep")
def list_semgrep(engagement_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(SemgrepResult)
        .filter(SemgrepResult.engagement_id == engagement_id)
        .order_by(SemgrepResult.path, SemgrepResult.line)
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("/engagements/{engagement_id}/semgrep/bulk", status_code=201)
def bulk_create_semgrep(engagement_id: int, body: List[SemgrepFinding], db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    created = []
    for f in body:
        row = SemgrepResult(engagement_id=engagement_id, **f.model_dump())
        db.add(row)
        created.append(row)
    db.commit()
    for r in created:
        db.refresh(r)
    return [_serialize(r) for r in created]


@router.delete("/semgrep/{result_id}", status_code=204)
def delete_semgrep(result_id: int, db: Session = Depends(get_db)):
    row = db.query(SemgrepResult).filter(SemgrepResult.id == result_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()


@router.delete("/engagements/{engagement_id}/semgrep", status_code=204)
def clear_semgrep(engagement_id: int, db: Session = Depends(get_db)):
    db.query(SemgrepResult).filter(SemgrepResult.engagement_id == engagement_id).delete()
    db.commit()
