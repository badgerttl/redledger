import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Screenshot, Asset, Finding

router = APIRouter(tags=["screenshots"])

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"}


def _serialize(s: Screenshot) -> dict:
    return {
        "id": s.id,
        "asset_id": s.asset_id,
        "finding_id": s.finding_id,
        "filename": s.filename,
        "caption": s.caption,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


async def _save_screenshot(
    file: UploadFile,
    caption: str,
    db: Session,
    asset_id: int | None = None,
    finding_id: int | None = None,
) -> Screenshot:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(415, f"Unsupported file type '{file.content_type}'. Allowed: image/png, image/jpeg, image/gif, image/webp, application/pdf")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix if file.filename else ".png"
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / stored_name
    try:
        with open(dest, "wb") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(500, f"Failed to save file: {e}") from e

    sc = Screenshot(
        asset_id=asset_id,
        finding_id=finding_id,
        file_path=str(dest),
        filename=file.filename or stored_name,
        caption=caption,
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


@router.post("/assets/{asset_id}/screenshots", status_code=201)
async def upload_asset_screenshot(
    asset_id: int,
    file: UploadFile = File(...),
    caption: str = Form(""),
    db: Session = Depends(get_db),
):
    if not db.query(Asset).filter(Asset.id == asset_id).first():
        raise HTTPException(404, "Asset not found")
    sc = await _save_screenshot(file, caption, db, asset_id=asset_id)
    return _serialize(sc)


@router.post("/findings/{finding_id}/screenshots", status_code=201)
async def upload_finding_screenshot(
    finding_id: int,
    file: UploadFile = File(...),
    caption: str = Form(""),
    db: Session = Depends(get_db),
):
    if not db.query(Finding).filter(Finding.id == finding_id).first():
        raise HTTPException(404, "Finding not found")
    sc = await _save_screenshot(file, caption, db, finding_id=finding_id)
    return _serialize(sc)


@router.get("/screenshots/{screenshot_id}")
def get_screenshot_meta(screenshot_id: int, db: Session = Depends(get_db)):
    sc = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()
    if not sc:
        raise HTTPException(404, "Screenshot not found")
    return _serialize(sc)


@router.get("/screenshots/{screenshot_id}/file")
def get_screenshot_file(screenshot_id: int, db: Session = Depends(get_db)):
    sc = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()
    if not sc:
        raise HTTPException(404, "Screenshot not found")
    if not os.path.exists(sc.file_path):
        raise HTTPException(404, "File missing from disk")
    return FileResponse(sc.file_path, filename=sc.filename)


@router.get("/assets/{asset_id}/screenshots")
def list_asset_screenshots(asset_id: int, db: Session = Depends(get_db)):
    return [_serialize(s) for s in db.query(Screenshot).filter(Screenshot.asset_id == asset_id).order_by(Screenshot.created_at.desc()).all()]


@router.get("/findings/{finding_id}/screenshots")
def list_finding_screenshots(finding_id: int, db: Session = Depends(get_db)):
    return [_serialize(s) for s in db.query(Screenshot).filter(Screenshot.finding_id == finding_id).order_by(Screenshot.created_at.desc()).all()]


@router.delete("/screenshots/{screenshot_id}", status_code=204)
def delete_screenshot(screenshot_id: int, db: Session = Depends(get_db)):
    sc = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()
    if not sc:
        raise HTTPException(404, "Screenshot not found")
    if os.path.exists(sc.file_path):
        os.remove(sc.file_path)
    db.delete(sc)
    db.commit()
