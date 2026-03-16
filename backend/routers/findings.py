from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Finding, Engagement, Asset, Tag, ToolOutput

router = APIRouter(tags=["findings"])


class FindingCreate(BaseModel):
    title: str
    description: str = ""
    impact: str = ""
    remediation: str = ""
    severity: str = "Info"
    cvss_score: Optional[float] = None
    cvss_vector: str = ""
    status: str = "draft"
    phase: str = ""
    asset_ids: list[int] = []
    tool_output_ids: list[int] = []


class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    remediation: Optional[str] = None
    severity: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    asset_ids: Optional[list[int]] = None
    tool_output_ids: Optional[list[int]] = None
    tag_ids: Optional[list[int]] = None


def _serialize(f: Finding) -> dict:
    return {
        "id": f.id,
        "engagement_id": f.engagement_id,
        "title": f.title,
        "description": f.description,
        "impact": f.impact,
        "remediation": f.remediation,
        "severity": f.severity,
        "cvss_score": f.cvss_score,
        "cvss_vector": f.cvss_vector,
        "status": f.status,
        "phase": f.phase,
        "affected_assets": [{"id": a.id, "name": a.name, "target": a.target} for a in f.affected_assets],
        "linked_tool_outputs": [{"id": t.id, "tool_name": t.tool_name} for t in f.linked_tool_outputs],
        "screenshots": [{"id": s.id, "filename": s.filename, "caption": s.caption} for s in f.screenshots],
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in f.tags],
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


@router.get("/engagements/{engagement_id}/findings")
def list_findings(
    engagement_id: int,
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Finding).filter(Finding.engagement_id == engagement_id)
    if severity:
        q = q.filter(Finding.severity == severity)
    if status:
        q = q.filter(Finding.status == status)
    if phase:
        q = q.filter(Finding.phase == phase)
    return [_serialize(f) for f in q.order_by(Finding.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/findings", status_code=201)
def create_finding(engagement_id: int, body: FindingCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    data = body.model_dump()
    asset_ids = data.pop("asset_ids", [])
    tool_output_ids = data.pop("tool_output_ids", [])
    finding = Finding(engagement_id=engagement_id, **data)
    if asset_ids:
        finding.affected_assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    if tool_output_ids:
        finding.linked_tool_outputs = db.query(ToolOutput).filter(ToolOutput.id.in_(tool_output_ids)).all()
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return _serialize(finding)


@router.get("/findings/{finding_id}")
def get_finding(finding_id: int, db: Session = Depends(get_db)):
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    return _serialize(f)


@router.patch("/findings/{finding_id}")
def update_finding(finding_id: int, body: FindingUpdate, db: Session = Depends(get_db)):
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    data = body.model_dump(exclude_unset=True)
    asset_ids = data.pop("asset_ids", None)
    tool_output_ids = data.pop("tool_output_ids", None)
    tag_ids = data.pop("tag_ids", None)
    for k, v in data.items():
        setattr(f, k, v)
    if asset_ids is not None:
        f.affected_assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    if tool_output_ids is not None:
        f.linked_tool_outputs = db.query(ToolOutput).filter(ToolOutput.id.in_(tool_output_ids)).all()
    if tag_ids is not None:
        f.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    db.commit()
    db.refresh(f)
    return _serialize(f)


@router.delete("/findings/{finding_id}", status_code=204)
def delete_finding(finding_id: int, db: Session = Depends(get_db)):
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    db.delete(f)
    db.commit()
