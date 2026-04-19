import xml.etree.ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Asset, Finding, ToolOutput, ActivityLog, Engagement

router = APIRouter(tags=["burp_import"])

_SEVERITY_MAP = {
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "information": "Info",
    "info": "Info",
}


def _get_text(el, tag: str, default: str = "") -> str:
    child = el.find(tag)
    if child is None:
        return default
    return (child.text or "").strip()


@router.post("/engagements/{engagement_id}/import/burp", status_code=201)
async def import_burp(engagement_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")

    content = await file.read()
    xml_text = content.decode("utf-8", errors="replace")

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        raise HTTPException(400, "Invalid XML file")

    # Support both <issues> root and direct <issue> children
    issues = root.findall(".//issue") if root.tag != "issue" else [root]
    if not issues:
        raise HTTPException(400, "No Burp issues found in XML")

    created_findings = []

    for issue_el in issues:
        name = _get_text(issue_el, "name")
        if not name:
            continue

        severity_raw = _get_text(issue_el, "severity", "Information").lower()
        severity = _SEVERITY_MAP.get(severity_raw, "Info")

        host_el = issue_el.find("host")
        host_ip = ""
        host_label = ""
        if host_el is not None:
            host_ip = host_el.get("ip", "").strip()
            host_label = (host_el.text or "").strip()

        path = _get_text(issue_el, "path")

        # Build description from issueBackground + issueDetail
        parts = []
        background = _get_text(issue_el, "issueBackground")
        detail = _get_text(issue_el, "issueDetail")
        if background:
            parts.append(background)
        if detail:
            parts.append(detail)
        description = "\n\n".join(parts)

        # Build remediation from remediationBackground + remediationDetail
        rem_parts = []
        rem_bg = _get_text(issue_el, "remediationBackground")
        rem_detail = _get_text(issue_el, "remediationDetail")
        if rem_bg:
            rem_parts.append(rem_bg)
        if rem_detail:
            rem_parts.append(rem_detail)
        remediation = "\n\n".join(rem_parts)

        # Find or create asset for the host
        asset = None
        if host_ip:
            asset = db.query(Asset).filter(
                Asset.engagement_id == engagement_id,
                Asset.target == host_ip,
            ).first()
            if not asset:
                target_label = host_label or host_ip
                asset = Asset(
                    engagement_id=engagement_id,
                    name=target_label,
                    asset_type="web_page" if (host_label.startswith("http") or path) else "host",
                    target=host_ip,
                )
                db.add(asset)
                db.flush()

        title = name
        if path and path != "/":
            title = f"{name} ({path})"

        finding = Finding(
            engagement_id=engagement_id,
            title=title,
            severity=severity,
            status="draft",
            phase="Exploitation",
            description=description,
            remediation=remediation,
        )
        if asset:
            finding.affected_assets = [asset]
        db.add(finding)
        db.flush()
        created_findings.append({"id": finding.id, "title": title, "severity": severity})

    to = ToolOutput(
        engagement_id=engagement_id,
        tool_name="burpsuite",
        phase="Exploitation",
        content=xml_text[:50000],
        source_file=file.filename or "burp_scan.xml",
    )
    db.add(to)

    db.add(ActivityLog(
        engagement_id=engagement_id,
        action=f"Imported Burp Suite scan — {len(created_findings)} finding(s) created",
        phase="Exploitation",
    ))

    db.commit()

    return {"findings_created": len(created_findings), "findings": created_findings}
