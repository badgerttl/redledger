import csv
import io
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import Finding, Engagement, Asset, Tag, ToolOutput

router = APIRouter(tags=["findings"])

_TEMPLATES_PATH = Path(__file__).resolve().parent.parent / "finding_templates.json"


@router.get("/finding-templates")
def list_finding_templates():
    if not _TEMPLATES_PATH.exists():
        return []
    with open(_TEMPLATES_PATH) as f:
        return json.load(f)


class FindingCreate(BaseModel):
    title: str
    description: str = ""
    impact: str = ""
    remediation: str = ""
    references: str = ""
    severity: str = "Info"
    cvss_score: Optional[float] = None
    cvss_vector: str = ""
    status: str = "draft"
    phase: str = ""
    asset_ids: list[int] = []
    tool_output_ids: list[int] = []

    @field_validator('cvss_score')
    @classmethod
    def validate_cvss(cls, v):
        if v is not None and not (0.0 <= v <= 10.0):
            raise ValueError('CVSS score must be between 0.0 and 10.0')
        return v


class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    remediation: Optional[str] = None
    references: Optional[str] = None
    severity: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    asset_ids: Optional[list[int]] = None
    tool_output_ids: Optional[list[int]] = None
    tag_ids: Optional[list[int]] = None

    @field_validator('cvss_score')
    @classmethod
    def validate_cvss(cls, v):
        if v is not None and not (0.0 <= v <= 10.0):
            raise ValueError('CVSS score must be between 0.0 and 10.0')
        return v


def _serialize(f: Finding) -> dict:
    return {
        "id": f.id,
        "engagement_id": f.engagement_id,
        "title": f.title,
        "description": f.description,
        "impact": f.impact,
        "remediation": f.remediation,
        "references": f.references or "",
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
    q = db.query(Finding).filter(Finding.engagement_id == engagement_id).options(
        selectinload(Finding.affected_assets),
        selectinload(Finding.linked_tool_outputs),
        selectinload(Finding.screenshots),
        selectinload(Finding.tags),
    )
    if severity:
        q = q.filter(Finding.severity == severity)
    if status:
        q = q.filter(Finding.status == status)
    if phase:
        q = q.filter(Finding.phase == phase)
    return [_serialize(f) for f in q.order_by(Finding.created_at.desc()).all()]


def _csv_safe_cell(val) -> str:
    if val is None:
        return ""
    s = str(val).replace("\r\n", "\n").replace("\r", "\n")
    if s and s[0] in "=-+@\t":
        return "'" + s
    return s


@router.get("/engagements/{engagement_id}/findings/export")
def export_findings_csv(engagement_id: int, db: Session = Depends(get_db)):
    """UTF-8 CSV with full finding fields for spreadsheets (Excel, Sheets)."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")
    rows = (
        db.query(Finding)
        .filter(Finding.engagement_id == engagement_id)
        .options(
            selectinload(Finding.affected_assets),
            selectinload(Finding.tags),
            selectinload(Finding.linked_tool_outputs),
            selectinload(Finding.screenshots),
        )
        .order_by(Finding.created_at.desc())
        .all()
    )
    out = io.StringIO(newline="")
    w = csv.writer(out, quoting=csv.QUOTE_MINIMAL)
    w.writerow(
        [
            "id",
            "title",
            "severity",
            "cvss_score",
            "cvss_vector",
            "status",
            "phase",
            "description",
            "impact",
            "remediation",
            "references",
            "affected_assets",
            "tags",
            "linked_tool_outputs",
            "screenshot_files",
            "created_at",
            "updated_at",
        ]
    )
    for f in rows:
        assets = "; ".join(f"{a.name} ({a.target})" if a.target else a.name for a in f.affected_assets)
        tags = "; ".join(t.name for t in f.tags)
        tools = "; ".join(f"{t.tool_name} (id {t.id})" for t in f.linked_tool_outputs)
        shots = "; ".join(s.filename for s in f.screenshots)
        w.writerow(
            [
                f.id,
                _csv_safe_cell(f.title),
                f.severity,
                f.cvss_score if f.cvss_score is not None else "",
                _csv_safe_cell(f.cvss_vector or ""),
                f.status,
                _csv_safe_cell(f.phase or ""),
                _csv_safe_cell(f.description or ""),
                _csv_safe_cell(f.impact or ""),
                _csv_safe_cell(f.remediation or ""),
                _csv_safe_cell(f.references or ""),
                _csv_safe_cell(assets),
                _csv_safe_cell(tags),
                _csv_safe_cell(tools),
                _csv_safe_cell(shots),
                f.created_at.isoformat() if f.created_at else "",
                f.updated_at.isoformat() if f.updated_at else "",
            ]
        )
    payload = "\ufeff" + out.getvalue()
    buf = io.BytesIO(payload.encode("utf-8"))
    buf.seek(0)
    safe_eng = "".join(c if c.isalnum() or c in "-_" else "_" for c in (eng.name or "engagement"))[:50]
    filename = f"findings_{safe_eng}_{engagement_id}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.get("/assets/{asset_id}/findings")
def list_findings_for_asset(asset_id: int, db: Session = Depends(get_db)):
    """Return all findings linked to a specific asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).options(
        selectinload(Asset.findings).options(
            selectinload(Finding.affected_assets),
            selectinload(Finding.linked_tool_outputs),
            selectinload(Finding.screenshots),
            selectinload(Finding.tags),
        )
    ).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    return [_serialize(f) for f in sorted(asset.findings, key=lambda f: f.created_at or "", reverse=True)]


@router.delete("/findings/{finding_id}", status_code=204)
def delete_finding(finding_id: int, db: Session = Depends(get_db)):
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    db.delete(f)
    db.commit()
