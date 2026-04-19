import base64
import mimetypes
from pathlib import Path

import markdown as mdlib
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.data_paths import REPORT_DIR
from backend.models import Engagement, Scope, ScopeEntry, Finding, ChecklistItem, Asset

router = APIRouter(tags=["reports"])

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = BASE_DIR / "templates"

SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4}


def _markdown_to_html(text) -> Markup:
    """Render stored finding/scope text (Markdown) to HTML for PDF/HTML reports."""
    if text is None:
        return Markup("")
    s = str(text).strip()
    if not s:
        return Markup("")
    html = mdlib.markdown(
        s,
        extensions=["extra", "nl2br", "sane_lists"],
        output_format="html",
    )
    return Markup(html)


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _embed_screenshots(screenshots) -> list:
    """Convert Screenshot ORM objects → list of embed dicts for templates."""
    result = []
    for s in screenshots:
        path = Path(s.file_path)
        ext = path.suffix.lower()
        is_image = ext in _IMAGE_EXTS
        is_pdf = ext == ".pdf"
        data_uri = None
        missing = False
        if is_image:
            try:
                raw = path.read_bytes()
                mime = mimetypes.guess_type(s.filename)[0] or f"image/{ext.lstrip('.')}"
                data_uri = f"data:{mime};base64,{base64.b64encode(raw).decode()}"
            except OSError:
                missing = True
        else:
            missing = not path.is_file()
        result.append(
            {
                "filename": s.filename,
                "caption": s.caption or "",
                "data_uri": data_uri,
                "is_pdf": is_pdf,
                "missing": missing,
            }
        )
    return result


def _html_env() -> Environment:
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    env.filters["markdown"] = _markdown_to_html
    env.filters["embed_screenshots"] = _embed_screenshots
    return env


def _get_report_data(engagement_id: int, db: Session) -> dict:
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(404, "Engagement not found")
    scope = db.query(Scope).filter(Scope.engagement_id == engagement_id).first()
    scope_entries = db.query(ScopeEntry).filter(ScopeEntry.engagement_id == engagement_id).all()
    findings = (
        db.query(Finding)
        .options(
            selectinload(Finding.affected_assets),
            selectinload(Finding.screenshots),
        )
        .filter(Finding.engagement_id == engagement_id)
        .all()
    )
    findings.sort(key=lambda f: SEVERITY_ORDER.get(f.severity, 5))
    checklists = db.query(ChecklistItem).filter(ChecklistItem.engagement_id == engagement_id).all()
    applicable = [c for c in checklists if not getattr(c, "is_na", False)]
    total_items = len(applicable)
    checked_items = sum(1 for c in applicable if c.is_checked)
    severity_counts: dict = {}
    for f in findings:
        severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1
    return dict(
        engagement=eng,
        scope=scope,
        scope_entries=scope_entries,
        findings=findings,
        severity_counts=severity_counts,
        total_checklist=total_items,
        checked_checklist=checked_items,
    )


def _render_html(engagement_id: int, db: Session) -> str:
    data = _get_report_data(engagement_id, db)
    env = _html_env()
    template = env.get_template("report_template.html")
    return template.render(**data)


def _generate_markdown(engagement_id: int, db: Session) -> str:
    data = _get_report_data(engagement_id, db)
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    try:
        template = env.get_template("report_template.md")
    except Exception:
        template = env.from_string(_DEFAULT_TEMPLATE)
    return template.render(**data)


@router.post("/engagements/{engagement_id}/report")
def generate_report(engagement_id: int, db: Session = Depends(get_db)):
    md_content = _generate_markdown(engagement_id, db)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = REPORT_DIR / f"engagement_{engagement_id}_report.md"
    md_path.write_text(md_content)

    return {"message": "Report generated", "formats": ["md", "html", "pdf"]}


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

    if format == "html":
        html = _render_html(engagement_id, db)
        return Response(
            content=html,
            media_type="text/html",
            headers={"Content-Disposition": f"attachment; filename=engagement_{engagement_id}_report.html"},
        )

    if format == "pdf":
        try:
            import weasyprint
        except ImportError:
            raise HTTPException(500, "weasyprint not installed — PDF export unavailable")
        html = _render_html(engagement_id, db)
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=engagement_{engagement_id}_report.pdf"},
        )

    raise HTTPException(400, f"Unsupported format: {format}")


_SINGLE_FINDING_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ f.severity }} — {{ f.title }}</title>
<style>
  :root {
    --accent: #6366f1;
    --critical: #dc2626; --high: #f97316; --medium: #eab308; --low: #22c55e; --info: #94a3b8;
    --text: #1e293b; --muted: #64748b; --border: #e2e8f0; --bg: #ffffff; --card: #f8fafc;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: var(--text); background: var(--bg); max-width: 860px; margin: 0 auto; padding: 40px 48px; }
  .cover { padding: 48px 0 36px; border-bottom: 3px solid var(--accent); margin-bottom: 36px; }
  .cover h1 { font-size: 1.7rem; font-weight: 700; margin-bottom: 10px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 20px; }
  .meta-item label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; margin-bottom: 2px; }
  .meta-item span { font-size: 13px; font-weight: 500; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .badge-critical { background: #fef2f2; color: var(--critical); }
  .badge-high     { background: #fff7ed; color: var(--high); }
  .badge-medium   { background: #fefce8; color: #a16207; }
  .badge-low      { background: #f0fdf4; color: #15803d; }
  .badge-info     { background: #f1f5f9; color: var(--muted); }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(99,102,241,.1); color: var(--accent); }
  h2 { font-size: 1.1rem; font-weight: 700; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--border); }
  h3 { font-size: .95rem; font-weight: 600; margin: 20px 0 8px; }
  .rich-text p { margin: 0 0 10px; }
  .rich-text p:last-child { margin-bottom: 0; }
  .rich-text ul, .rich-text ol { margin: 8px 0 10px 22px; }
  .rich-text li { margin-bottom: 4px; }
  .rich-text h1,.rich-text h2,.rich-text h3,.rich-text h4 { margin: 14px 0 8px; font-weight: 600; border: none; padding: 0; }
  .rich-text code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  .rich-text pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 10px 0; }
  .rich-text pre code { background: transparent; padding: 0; color: inherit; }
  .rich-text blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid var(--accent); background: var(--card); color: var(--muted); }
  .rich-text a { color: var(--accent); word-break: break-all; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: rgba(99,102,241,.1); color: var(--accent); margin-right: 4px; }
  .section-card { border: 1px solid var(--border); border-radius: 10px; padding: 20px 22px; margin-bottom: 20px; }
  .ref-link { display: block; font-family: ui-monospace, monospace; font-size: 12px; color: var(--accent); word-break: break-all; margin-bottom: 4px; }
  .evidence-grid { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
  .evidence-item { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
  .evidence-item img { display: block; max-width: 100%; height: auto; }
  .evidence-caption { font-size: 12px; color: var(--muted); padding: 6px 10px; background: #f8fafc; border-top: 1px solid var(--border); }
  .evidence-pdf { padding: 10px 14px; font-size: 13px; background: #f8fafc; color: var(--muted); }
  .evidence-missing { padding: 10px 14px; font-size: 12px; color: #f97316; background: #fff7ed; }
  @media print { body { padding: 20px 28px; } }
  @page { margin: 20mm 18mm; }
</style>
</head>
<body>
<div class="cover">
  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px;">
    <span class="badge badge-{{ f.severity | lower }}">{{ f.severity }}</span>
    <span class="status-badge">{{ f.status | capitalize }}</span>
  </div>
  <h1>{{ f.title }}</h1>
  <div class="meta-row">
    {% if f.cvss_score is not none %}
    <div class="meta-item"><label>CVSS Score</label><span>{{ f.cvss_score }}</span></div>
    {% endif %}
    {% if f.cvss_vector %}
    <div class="meta-item"><label>CVSS Vector</label><span style="font-family:monospace;font-size:12px;">{{ f.cvss_vector }}</span></div>
    {% endif %}
    {% if f.phase %}
    <div class="meta-item"><label>Phase</label><span>{{ f.phase }}</span></div>
    {% endif %}
    {% if f.engagement_name %}
    <div class="meta-item"><label>Engagement</label><span>{{ f.engagement_name }}</span></div>
    {% endif %}
    {% if f.affected_assets %}
    <div class="meta-item"><label>Affected Assets</label><span>{{ f.affected_assets | map(attribute='name') | join(', ') }}</span></div>
    {% endif %}
  </div>
</div>

{% if f.description %}
<div class="section-card">
  <h2>Description</h2>
  <div class="rich-text">{{ f.description | markdown }}</div>
</div>
{% endif %}

{% if f.impact %}
<div class="section-card">
  <h2>Impact</h2>
  <div class="rich-text">{{ f.impact | markdown }}</div>
</div>
{% endif %}

{% if f.remediation %}
<div class="section-card">
  <h2>Remediation</h2>
  <div class="rich-text">{{ f.remediation | markdown }}</div>
</div>
{% endif %}

{% if f.references and f.references.strip() %}
<div class="section-card">
  <h2>References</h2>
  {% for line in f.references.strip().splitlines() %}
  {% if line.strip() %}<a class="ref-link" href="{{ line.strip() }}" target="_blank">{{ line.strip() }}</a>{% endif %}
  {% endfor %}
</div>
{% endif %}

{% set embeds = f.screenshots | embed_screenshots %}
{% if embeds %}
<div class="section-card">
  <h2>Evidence</h2>
  <div class="evidence-grid">
    {% for e in embeds %}
    <div class="evidence-item">
      {% if e.data_uri %}
      <img src="{{ e.data_uri }}" alt="{{ e.filename }}" />
      {% elif e.is_pdf %}
      <div class="evidence-pdf">📎 {{ e.filename }} (PDF attachment)</div>
      {% elif e.missing %}
      <div class="evidence-missing">⚠ {{ e.filename }} — file not found on disk</div>
      {% endif %}
      {% if e.caption %}<div class="evidence-caption">{{ e.caption }}</div>{% endif %}
    </div>
    {% endfor %}
  </div>
</div>
{% endif %}

{% if f.tags %}
<div style="margin-top:8px;">
  {% for t in f.tags %}<span class="tag">{{ t.name }}</span>{% endfor %}
</div>
{% endif %}

</body>
</html>
"""


def _render_single_finding_html(finding_id: int, db: Session) -> tuple[str, str]:
    """Returns (html_string, safe_title)."""
    f = (
        db.query(Finding)
        .options(
            selectinload(Finding.affected_assets),
            selectinload(Finding.tags),
            selectinload(Finding.screenshots),
        )
        .filter(Finding.id == finding_id)
        .first()
    )
    if not f:
        raise HTTPException(404, "Finding not found")
    eng = db.query(Engagement).filter(Engagement.id == f.engagement_id).first()
    f.engagement_name = eng.name if eng else None
    env = _html_env()
    template = env.from_string(_SINGLE_FINDING_TEMPLATE)
    html = template.render(f=f)
    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in f.title)[:60]
    return html, safe_title


@router.get("/findings/{finding_id}/report/download")
def download_finding_report(
    finding_id: int,
    format: str = Query("html"),
    db: Session = Depends(get_db),
):
    if format == "html":
        html, safe_title = _render_single_finding_html(finding_id, db)
        return Response(
            content=html,
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="finding_{safe_title}.html"'},
        )

    if format == "pdf":
        try:
            import weasyprint
        except ImportError:
            raise HTTPException(500, "weasyprint not installed — PDF export unavailable")
        html, safe_title = _render_single_finding_html(finding_id, db)
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="finding_{safe_title}.pdf"'},
        )

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
