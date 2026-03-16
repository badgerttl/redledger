import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Engagement, Scope, ScopeEntry, Finding, ChecklistItem

router = APIRouter(tags=["reports"])

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = BASE_DIR / "templates"
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR.parent / "data"))
REPORT_DIR = DATA_DIR / "reports"

SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4}


def _generate_markdown(engagement_id: int, db: Session) -> str:
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")

    scope = db.query(Scope).filter(Scope.engagement_id == engagement_id).first()
    scope_entries = db.query(ScopeEntry).filter(ScopeEntry.engagement_id == engagement_id).all()
    findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
    findings.sort(key=lambda f: SEVERITY_ORDER.get(f.severity, 5))
    checklists = db.query(ChecklistItem).filter(ChecklistItem.engagement_id == engagement_id).all()

    total_items = len(checklists)
    checked_items = sum(1 for c in checklists if c.is_checked)

    severity_counts = {}
    for f in findings:
        severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    try:
        template = env.get_template("report_template.md")
    except Exception:
        template = env.from_string(_DEFAULT_TEMPLATE)

    return template.render(
        engagement=eng,
        scope=scope,
        scope_entries=scope_entries,
        findings=findings,
        severity_counts=severity_counts,
        total_checklist=total_items,
        checked_checklist=checked_items,
    )


@router.post("/engagements/{engagement_id}/report")
def generate_report(engagement_id: int, db: Session = Depends(get_db)):
    md_content = _generate_markdown(engagement_id, db)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = REPORT_DIR / f"engagement_{engagement_id}_report.md"
    md_path.write_text(md_content)

    return {"message": "Report generated", "formats": ["md"]}


@router.get("/engagements/{engagement_id}/report/download")
def download_report(
    engagement_id: int,
    format: str = Query("md"),
    db: Session = Depends(get_db),
):
    if format == "md":
        path = REPORT_DIR / f"engagement_{engagement_id}_report.md"
        if not path.exists():
            raise HTTPException(404, "Report not generated yet. Generate it first.")
        return FileResponse(path, filename=f"engagement_{engagement_id}_report.md", media_type="text/markdown")
    raise HTTPException(400, f"Unsupported format: {format}")


_DEFAULT_TEMPLATE = """# Penetration Test Report — {{ engagement.name }}

**Client:** {{ engagement.client_name or 'N/A' }}
**Date:** {{ engagement.start_date or 'N/A' }} — {{ engagement.end_date or 'N/A' }}
**Status:** {{ engagement.status }}

---

## Executive Summary

This engagement identified **{{ findings|length }}** finding(s):
{% for sev, count in severity_counts.items() %}- {{ sev }}: {{ count }}
{% endfor %}

Methodology completion: {{ checked_checklist }}/{{ total_checklist }} checklist items completed.

---

## Scope

**In Scope:**
{{ scope.in_scope if scope else 'Not defined' }}

**Out of Scope:**
{{ scope.out_scope if scope else 'Not defined' }}

{% if scope_entries %}### Scope Entries
{% for e in scope_entries %}- [{{ e.entry_type }}] {{ e.value }}
{% endfor %}{% endif %}

---

## Findings

{% for f in findings %}### {{ f.severity }} — {{ f.title }}

**CVSS Score:** {{ f.cvss_score or 'N/A' }}
**Status:** {{ f.status }}
**Phase:** {{ f.phase or 'N/A' }}

#### Description
{{ f.description or 'No description provided.' }}

#### Impact
{{ f.impact or 'No impact statement provided.' }}

#### Remediation
{{ f.remediation or 'No remediation provided.' }}

---

{% endfor %}

## Rules of Engagement

{{ engagement.rules_of_engagement or 'Not specified.' }}
"""
