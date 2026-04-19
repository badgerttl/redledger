"""
Engagement export / import.

Export: GET /engagements/{id}/export
  Returns a .zip containing:
    manifest.json  – all DB data for the engagement
    files/         – every screenshot / attachment referenced in the manifest

Import: POST /engagements/import  (multipart: file=<zip>)
  Reads the zip, re-creates everything in the DB with fresh IDs,
  copies files to UPLOAD_DIR / REPORT_DIR, and returns the new engagement.

ID-remapping order:
  engagement → scope + scope_entries → tags (merged by name) →
  assets → notes → tool_outputs → findings → credentials →
  checklist_items → activity_logs → screenshots → report files
"""

import io
import json
import re
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.data_paths import UPLOAD_DIR, REPORT_DIR
from backend.models import (
    Engagement, Scope, ScopeEntry,
    Asset, Note, Tag,
    ToolOutput, Finding, Screenshot,
    Credential, ChecklistItem, ActivityLog,
    asset_tag, finding_tag, tool_output_tag, note_tag,
    finding_asset, finding_tool_output, credential_asset,
)

router = APIRouter(tags=["engagement_io"])

EXPORT_FORMAT_VERSION = "1"


# ── helpers ───────────────────────────────────────────────────────────

def _tag_dict(tag: Tag) -> dict:
    return {"name": tag.name, "color": tag.color}


def _screenshot_dict(s: Screenshot) -> dict:
    return {
        "id": s.id,
        "filename": s.filename,
        "caption": s.caption,
        "file_path": s.file_path,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _get_or_create_tag(db: Session, name: str, color: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if tag:
        return tag
    tag = Tag(name=name, color=color)
    db.add(tag)
    db.flush()
    return tag


def _register_engagement_screenshot_files(
    db: Session,
    engagement_id: int,
    files_to_include: list[tuple[Path, str]],
) -> dict[int, str | None]:
    """
    Map every Screenshot row for this engagement (via Asset or Finding) to a zip member.
    Separate from ORM selectinload so finding evidence always included in export.
    """
    seen_zip: set[str] = set()
    id_to_zip: dict[int, str | None] = {}
    rows = (
        db.query(Screenshot)
        .outerjoin(Asset, Screenshot.asset_id == Asset.id)
        .outerjoin(Finding, Screenshot.finding_id == Finding.id)
        .filter(or_(Asset.engagement_id == engagement_id, Finding.engagement_id == engagement_id))
        .all()
    )
    for sc in rows:
        p = Path(sc.file_path)
        if not p.is_file():
            id_to_zip[sc.id] = None
            continue
        zip_name = f"files/{p.name}"
        if zip_name not in seen_zip:
            files_to_include.append((p, zip_name))
            seen_zip.add(zip_name)
        id_to_zip[sc.id] = zip_name
    return id_to_zip


def _screenshots_for_manifest(screenshots, id_to_zip: dict[int, str | None]) -> list[dict]:
    out: list[dict] = []
    for s in screenshots:
        d = _screenshot_dict(s)
        d["zip_path"] = id_to_zip.get(s.id)
        out.append(d)
    return out


# ── EXPORT ────────────────────────────────────────────────────────────

@router.get("/engagements/{engagement_id}/export")
def export_engagement(engagement_id: int, db: Session = Depends(get_db)):
    eng = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id)
        .options(
            selectinload(Engagement.scope),
            selectinload(Engagement.scope_entries),
            selectinload(Engagement.assets)
                .selectinload(Asset.notes)
                .selectinload(Note.tags),
            selectinload(Engagement.assets)
                .selectinload(Asset.screenshots),
            selectinload(Engagement.assets)
                .selectinload(Asset.tags),
            selectinload(Engagement.findings).options(
                selectinload(Finding.affected_assets),
                selectinload(Finding.linked_tool_outputs),
                selectinload(Finding.screenshots),
                selectinload(Finding.tags),
            ),
            selectinload(Engagement.credentials)
                .selectinload(Credential.assets),
            selectinload(Engagement.tool_outputs)
                .selectinload(ToolOutput.tags),
            selectinload(Engagement.checklist_items),
            selectinload(Engagement.activity_logs),
        )
        .first()
    )
    if not eng:
        raise HTTPException(404, "Engagement not found")

    # Collect files: screenshots (explicit query = finding evidence never skipped)
    files_to_include: list[tuple[Path, str]] = []
    screenshot_id_to_zip = _register_engagement_screenshot_files(db, engagement_id, files_to_include)

    manifest = {
        "version": EXPORT_FORMAT_VERSION,
        "engagement": {
            "name": eng.name,
            "description": eng.description,
            "status": eng.status,
            "client_name": eng.client_name,
            "client_contact": eng.client_contact,
            "start_date": eng.start_date,
            "end_date": eng.end_date,
            "rules_of_engagement": eng.rules_of_engagement,
            "authorization_doc": eng.authorization_doc,
        },
        "scope": {
            "in_scope": eng.scope.in_scope if eng.scope else "",
            "out_scope": eng.scope.out_scope if eng.scope else "",
        } if eng.scope else None,
        "scope_entries": [
            {"entry_type": e.entry_type, "value": e.value}
            for e in eng.scope_entries
        ],
        "assets": [
            {
                "id": a.id,
                "name": a.name,
                "asset_type": a.asset_type,
                "target": a.target,
                "os": a.os,
                "ports_summary": a.ports_summary,
                "tags": [_tag_dict(t) for t in a.tags],
                "notes": [
                    {
                        "body": n.body,
                        "tags": [_tag_dict(t) for t in n.tags],
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    }
                    for n in sorted(a.notes, key=lambda n: n.created_at or "", reverse=False)
                ],
                "screenshots": _screenshots_for_manifest(a.screenshots, screenshot_id_to_zip),
            }
            for a in eng.assets
        ],
        "findings": [
            {
                "id": f.id,
                "title": f.title,
                "description": f.description,
                "impact": f.impact,
                "remediation": f.remediation,
                "references": f.references,
                "severity": f.severity,
                "cvss_score": f.cvss_score,
                "cvss_vector": f.cvss_vector,
                "status": f.status,
                "phase": f.phase,
                "tags": [_tag_dict(t) for t in f.tags],
                "affected_asset_old_ids": [a.id for a in f.affected_assets],
                "linked_tool_output_old_ids": [t.id for t in f.linked_tool_outputs],
                "screenshots": _screenshots_for_manifest(f.screenshots, screenshot_id_to_zip),
            }
            for f in eng.findings
        ],
        "credentials": [
            {
                "id": c.id,
                "username": c.username,
                "secret": c.secret,
                "secret_type": c.secret_type,
                "source": c.source,
                "access_level": c.access_level,
                "notes": c.notes,
                "linked_asset_old_ids": [a.id for a in c.assets],
            }
            for c in eng.credentials
        ],
        "tool_outputs": [
            {
                "id": t.id,
                "tool_name": t.tool_name,
                "phase": t.phase,
                "content": t.content,
                "source_file": t.source_file,
                "asset_old_id": t.asset_id,
                "tags": [_tag_dict(tg) for tg in t.tags],
            }
            for t in eng.tool_outputs
        ],
        "checklist_items": [
            {
                "phase": c.phase,
                "label": c.label,
                "description": c.description,
                "is_checked": c.is_checked,
                "is_na": bool(getattr(c, "is_na", False)),
                "sort_order": c.sort_order,
            }
            for c in eng.checklist_items
        ],
        "activity_logs": [
            {
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "action": a.action,
                "target": a.target,
                "phase": a.phase,
                "notes": a.notes,
            }
            for a in eng.activity_logs
        ],
    }

    report_entries: list[dict] = []
    if REPORT_DIR.exists():
        for rp in sorted(REPORT_DIR.glob(f"engagement_{engagement_id}_report*")):
            if not rp.is_file():
                continue
            zip_name = f"files/reports/{rp.name}"
            files_to_include.append((rp, zip_name))
            report_entries.append({"zip_path": zip_name, "filename": rp.name})
    manifest["reports"] = report_entries

    # Build the zip in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        seen: set[str] = set()
        for disk_path, zip_name in files_to_include:
            if zip_name in seen:
                continue
            seen.add(zip_name)
            try:
                zf.write(disk_path, zip_name)
            except OSError:
                pass  # skip missing files — already noted by zip_path being None
    buf.seek(0)

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in eng.name)[:50]
    filename = f"redledger_{safe_name}_{engagement_id}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── IMPORT ────────────────────────────────────────────────────────────

@router.post("/engagements/import", status_code=201)
async def import_engagement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise HTTPException(400, "Uploaded file is not a valid zip archive")

    tmpdir = Path(tempfile.mkdtemp(prefix="redledger_import_"))
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            zf.extractall(tmpdir)

        manifest_path = tmpdir / "manifest.json"
        if not manifest_path.exists():
            raise HTTPException(400, "Archive is missing manifest.json")

        manifest = json.loads(manifest_path.read_text())
        if str(manifest.get("version")) != EXPORT_FORMAT_VERSION:
            raise HTTPException(400, f"Unsupported export version: {manifest.get('version')!r}")

        return _do_import(db, manifest, tmpdir)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Import failed: {exc}") from exc
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _do_import(db: Session, manifest: dict, tmpdir: Path) -> dict:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Engagement ─────────────────────────────────────────────────
    e = manifest["engagement"]
    eng = Engagement(
        name=e.get("name", "Imported Engagement"),
        description=e.get("description", ""),
        status=e.get("status", "active"),
        client_name=e.get("client_name", ""),
        client_contact=e.get("client_contact", ""),
        start_date=e.get("start_date", ""),
        end_date=e.get("end_date", ""),
        rules_of_engagement=e.get("rules_of_engagement", ""),
        authorization_doc=e.get("authorization_doc", ""),
    )
    db.add(eng)
    db.flush()

    # ── 2. Scope ──────────────────────────────────────────────────────
    sc = manifest.get("scope")
    scope_row = Scope(
        engagement_id=eng.id,
        in_scope=sc.get("in_scope", "") if sc else "",
        out_scope=sc.get("out_scope", "") if sc else "",
    )
    db.add(scope_row)

    for se in manifest.get("scope_entries", []):
        db.add(ScopeEntry(
            engagement_id=eng.id,
            entry_type=se.get("entry_type", ""),
            value=se.get("value", ""),
        ))

    db.flush()

    # ── 3. Assets (old_id → new_id map) ───────────────────────────────
    asset_id_map: dict[int, int] = {}
    for a_data in manifest.get("assets", []):
        old_id = a_data["id"]
        asset = Asset(
            engagement_id=eng.id,
            name=a_data.get("name", ""),
            asset_type=a_data.get("asset_type", "host"),
            target=a_data.get("target", ""),
            os=a_data.get("os", ""),
            ports_summary=a_data.get("ports_summary", ""),
        )
        db.add(asset)
        db.flush()
        asset_id_map[old_id] = asset.id

        # Asset tags
        for td in a_data.get("tags", []):
            tag = _get_or_create_tag(db, td["name"], td.get("color", "#6366f1"))
            db.execute(asset_tag.insert().values(asset_id=asset.id, tag_id=tag.id))

        # Notes
        for nd in a_data.get("notes", []):
            note = Note(asset_id=asset.id, body=nd.get("body", ""))
            db.add(note)
            db.flush()
            for td in nd.get("tags", []):
                tag = _get_or_create_tag(db, td["name"], td.get("color", "#6366f1"))
                db.execute(note_tag.insert().values(note_id=note.id, tag_id=tag.id))

        # Asset screenshots
        for sd in a_data.get("screenshots", []):
            _import_screenshot(db, sd, tmpdir, asset_id=asset.id, finding_id=None)

    db.flush()

    # ── 4. Tool outputs (old_id → new_id map) ─────────────────────────
    tool_output_id_map: dict[int, int] = {}
    for t_data in manifest.get("tool_outputs", []):
        old_id = t_data["id"]
        old_asset_id = t_data.get("asset_old_id")
        new_asset_id = asset_id_map.get(old_asset_id) if old_asset_id is not None else None
        to = ToolOutput(
            engagement_id=eng.id,
            asset_id=new_asset_id,
            tool_name=t_data.get("tool_name", ""),
            phase=t_data.get("phase", ""),
            content=t_data.get("content", ""),
            source_file=t_data.get("source_file", ""),
        )
        db.add(to)
        db.flush()
        tool_output_id_map[old_id] = to.id

        for td in t_data.get("tags", []):
            tag = _get_or_create_tag(db, td["name"], td.get("color", "#6366f1"))
            db.execute(tool_output_tag.insert().values(tool_output_id=to.id, tag_id=tag.id))

    db.flush()

    # ── 5. Findings (old_id → new_id map) ─────────────────────────────
    finding_id_map: dict[int, int] = {}
    for f_data in manifest.get("findings", []):
        old_id = f_data["id"]
        finding = Finding(
            engagement_id=eng.id,
            title=f_data.get("title", ""),
            description=f_data.get("description", ""),
            impact=f_data.get("impact", ""),
            remediation=f_data.get("remediation", ""),
            references=f_data.get("references", ""),
            severity=f_data.get("severity", "Info"),
            cvss_score=f_data.get("cvss_score"),
            cvss_vector=f_data.get("cvss_vector", ""),
            status=f_data.get("status", "draft"),
            phase=f_data.get("phase", ""),
        )
        db.add(finding)
        db.flush()
        finding_id_map[old_id] = finding.id

        # Finding tags
        for td in f_data.get("tags", []):
            tag = _get_or_create_tag(db, td["name"], td.get("color", "#6366f1"))
            db.execute(finding_tag.insert().values(finding_id=finding.id, tag_id=tag.id))

        # Affected assets
        for old_asset_id in f_data.get("affected_asset_old_ids", []):
            new_asset_id = asset_id_map.get(old_asset_id)
            if new_asset_id:
                db.execute(finding_asset.insert().values(finding_id=finding.id, asset_id=new_asset_id))

        # Linked tool outputs
        for old_to_id in f_data.get("linked_tool_output_old_ids", []):
            new_to_id = tool_output_id_map.get(old_to_id)
            if new_to_id:
                db.execute(finding_tool_output.insert().values(finding_id=finding.id, tool_output_id=new_to_id))

        # Finding screenshots
        for sd in f_data.get("screenshots", []):
            _import_screenshot(db, sd, tmpdir, asset_id=None, finding_id=finding.id)

    db.flush()

    # ── 6. Credentials ────────────────────────────────────────────────
    for c_data in manifest.get("credentials", []):
        cred = Credential(
            engagement_id=eng.id,
            username=c_data.get("username", ""),
            secret=c_data.get("secret", ""),
            secret_type=c_data.get("secret_type", "plaintext"),
            source=c_data.get("source", ""),
            access_level=c_data.get("access_level", ""),
            notes=c_data.get("notes", ""),
        )
        db.add(cred)
        db.flush()

        for old_asset_id in c_data.get("linked_asset_old_ids", []):
            new_asset_id = asset_id_map.get(old_asset_id)
            if new_asset_id:
                db.execute(credential_asset.insert().values(credential_id=cred.id, asset_id=new_asset_id))

    db.flush()

    # ── 7. Checklist items ────────────────────────────────────────────
    for ci in manifest.get("checklist_items", []):
        db.add(ChecklistItem(
            engagement_id=eng.id,
            phase=ci.get("phase", ""),
            label=ci.get("label", ""),
            description=ci.get("description", ""),
            is_checked=ci.get("is_checked", False),
            is_na=ci.get("is_na", False),
            sort_order=ci.get("sort_order", 0),
        ))

    # ── 8. Activity logs ──────────────────────────────────────────────
    for al in manifest.get("activity_logs", []):
        db.add(ActivityLog(
            engagement_id=eng.id,
            action=al.get("action", ""),
            target=al.get("target", ""),
            phase=al.get("phase", ""),
            notes=al.get("notes", ""),
        ))

    db.commit()
    db.refresh(eng)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    for rd in manifest.get("reports", []):
        zp = rd.get("zip_path")
        if not zp:
            continue
        src = tmpdir / zp
        if not src.exists():
            continue
        fname = rd.get("filename") or Path(zp).name
        m = re.match(r"^engagement_\d+_(.+)$", fname)
        dst = REPORT_DIR / (f"engagement_{eng.id}_{m.group(1)}" if m else f"engagement_{eng.id}_{fname}")
        try:
            shutil.copy2(src, dst)
        except OSError:
            pass

    return {
        "id": eng.id,
        "name": eng.name,
        "status": eng.status,
        "message": f"Engagement '{eng.name}' imported successfully.",
    }


def _import_screenshot(
    db: Session,
    sd: dict,
    tmpdir: Path,
    asset_id: int | None,
    finding_id: int | None,
) -> None:
    zip_path = sd.get("zip_path")
    original_filename = sd.get("filename", "attachment")
    caption = sd.get("caption", "")

    if not zip_path:
        return

    src = tmpdir / zip_path
    if not src.exists():
        return

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(original_filename).suffix or ".bin"
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / stored_name

    try:
        shutil.copy2(src, dest)
    except OSError:
        return

    sc = Screenshot(
        asset_id=asset_id,
        finding_id=finding_id,
        file_path=str(dest),
        filename=original_filename,
        caption=caption,
    )
    db.add(sc)
    db.flush()
